// @vitest-environment jsdom
import { File as NodeFile } from "node:buffer";

import { beforeEach, describe, expect, it } from "vitest";
import { delay, http, HttpResponse } from "msw";

import type { VideoCreated } from "@/lib/api/contracts";
import { server } from "@/mocks/server";

import {
  MAX_CONCURRENT_PARTS,
  resumeUpload,
  startUpload,
  UploadCancelledError,
  UploadError,
} from "../multipart-uploader";

// Fake do BFF (`/api/videos/**`, same-origin) + storage presignado (origem pública de teste).
const STORAGE = "http://storage.test";
const MIB = 1024 * 1024;
const PART_SIZE = 5 * MIB;
const PUBLIC_ID = "vid-upload-1";

type FakeState = {
  state: "active" | "completed" | "aborted";
  deleted: boolean;
  partCount: number;
  expectedBytes: number;
  uploadedParts: { part_number: number; etag: string; size: number }[];
  presignBatches: number[][];
  /** `[partNumber, bytes]` de cada PUT aceito, na ordem de chegada. */
  accepted: [number, number][];
  putAttempts: Map<number, number>;
  failOnceWith500: Set<number>;
  /** Partes cuja primeira URL presignada está expirada (403). */
  expiredFirstUrl: Set<number>;
  hangPuts: boolean;
  inFlight: number;
  maxInFlight: number;
  completeBody: unknown;
};

let fake: FakeState;

function created(fileSize: number): VideoCreated {
  return {
    public_id: PUBLIC_ID,
    status: "draft",
    processing_status: "uploading",
    upload: {
      upload_id: "up-1",
      part_size: PART_SIZE,
      part_count: Math.ceil(fileSize / PART_SIZE),
      expires_at: "2026-10-20T00:00:00.000Z",
    },
  };
}

// O `File` do jsdom não é um corpo aceito pelo `fetch` do Node (seria serializado como texto);
// no navegador o Blob é nativo. O `File` do `node:buffer` reproduz o comportamento real.
function fileOf(bytes: number): File {
  return new NodeFile([new Uint8Array(bytes)], "aula.mp4", { type: "video/mp4" }) as unknown as File;
}

function notFound() {
  return HttpResponse.json(
    { statusCode: 404, error: "VIDEO_NOT_FOUND", message: "Video not found" },
    { status: 404 }
  );
}

function useFakeBackend(fileSize: number) {
  fake = {
    state: "active",
    deleted: false,
    partCount: Math.ceil(fileSize / PART_SIZE),
    expectedBytes: fileSize,
    uploadedParts: [],
    presignBatches: [],
    accepted: [],
    putAttempts: new Map(),
    failOnceWith500: new Set(),
    expiredFirstUrl: new Set(),
    hangPuts: false,
    inFlight: 0,
    maxInFlight: 0,
    completeBody: null,
  };
  server.use(
    http.post("/api/videos/:publicId/upload/parts", async ({ request }) => {
      if (fake.deleted) return notFound();
      const { part_numbers } = (await request.json()) as { part_numbers: number[] };
      fake.presignBatches.push(part_numbers);
      const generation = fake.presignBatches.length;
      return HttpResponse.json({
        upload_id: "up-1",
        part_size: PART_SIZE,
        expires_at: "2026-10-20T00:00:00.000Z",
        parts: part_numbers.map((n) => ({
          part_number: n,
          url: `${STORAGE}/videos/${PUBLIC_ID}/source?partNumber=${n}&gen=${generation}`,
        })),
      });
    }),
    http.put(`${STORAGE}/videos/:publicId/source`, async ({ request }) => {
      const url = new URL(request.url);
      const partNumber = Number(url.searchParams.get("partNumber"));
      const attempts = (fake.putAttempts.get(partNumber) ?? 0) + 1;
      fake.putAttempts.set(partNumber, attempts);
      fake.inFlight += 1;
      fake.maxInFlight = Math.max(fake.maxInFlight, fake.inFlight);
      try {
        if (fake.hangPuts) {
          await delay("infinite");
        }
        const bytes = (await request.arrayBuffer()).byteLength;
        await delay(5);
        if (fake.expiredFirstUrl.has(partNumber) && url.searchParams.get("gen") === "1") {
          return new HttpResponse(null, { status: 403 });
        }
        if (fake.failOnceWith500.has(partNumber) && attempts === 1) {
          return new HttpResponse(null, { status: 500 });
        }
        fake.accepted.push([partNumber, bytes]);
        return new HttpResponse(null, {
          status: 200,
          headers: { ETag: `"etag-${partNumber}"` },
        });
      } finally {
        fake.inFlight -= 1;
      }
    }),
    http.post("/api/videos/:publicId/upload/complete", async ({ request }) => {
      if (fake.deleted) return notFound();
      fake.completeBody = await request.json();
      fake.state = "completed";
      return HttpResponse.json(
        {
          public_id: PUBLIC_ID,
          status: "draft",
          processing_status: "processing",
          size_bytes: fake.expectedBytes,
        },
        { status: 202 }
      );
    }),
    http.get("/api/videos/:publicId/upload", () => {
      if (fake.deleted) return notFound();
      return HttpResponse.json({
        upload_id: "up-1",
        state: fake.state,
        part_size: PART_SIZE,
        part_count: fake.partCount,
        expected_bytes: fake.expectedBytes,
        expires_at: "2026-10-20T00:00:00.000Z",
        uploaded_parts: fake.uploadedParts,
      });
    }),
    http.delete("/api/videos/:publicId/upload", () => {
      if (fake.deleted) return notFound();
      // Como o backend: aborta a sessão e apaga o rascunho.
      fake.state = "aborted";
      fake.deleted = true;
      return new HttpResponse(null, { status: 204 });
    })
  );
}

beforeEach(() => {
  server.resetHandlers();
});

describe("startUpload", () => {
  it("sends a 12 MiB file as 5 + 5 + 2 MiB parts and completes with every ETag (202)", async () => {
    const file = fileOf(12 * MIB);
    useFakeBackend(file.size);
    const progress: number[] = [];

    const handle = startUpload({
      file,
      created: created(file.size),
      onProgress: ({ uploadedBytes }) => progress.push(uploadedBytes),
    });
    const result = await handle.done;

    expect(result).toMatchObject({ public_id: PUBLIC_ID, processing_status: "processing" });
    expect(new Map(fake.accepted)).toEqual(
      new Map([
        [1, 5 * MIB],
        [2, 5 * MIB],
        [3, 2 * MIB],
      ])
    );
    expect(fake.presignBatches).toEqual([[1, 2, 3]]);
    expect(fake.completeBody).toEqual({
      parts: [
        { part_number: 1, etag: '"etag-1"' },
        { part_number: 2, etag: '"etag-2"' },
        { part_number: 3, etag: '"etag-3"' },
      ],
    });
    expect(progress.at(-1)).toBe(12 * MIB);
    expect(handle.progress()).toEqual({ uploadedBytes: 12 * MIB, totalBytes: 12 * MIB });
  });

  it(`never runs more than ${MAX_CONCURRENT_PARTS} part PUTs at once`, async () => {
    const file = fileOf(10 * PART_SIZE);
    useFakeBackend(file.size);

    await startUpload({ file, created: created(file.size) }).done;

    expect(fake.accepted).toHaveLength(10);
    expect(fake.maxInFlight).toBeLessThanOrEqual(MAX_CONCURRENT_PARTS);
    expect(fake.maxInFlight).toBeGreaterThan(1);
  });

  it("retries a part after a transient 500 without resending the parts already accepted", async () => {
    const file = fileOf(12 * MIB);
    useFakeBackend(file.size);
    fake.failOnceWith500.add(2);

    await startUpload({ file, created: created(file.size), retryDelayMs: 1 }).done;

    expect(fake.putAttempts.get(2)).toBe(2);
    expect(fake.putAttempts.get(1)).toBe(1);
    expect(fake.putAttempts.get(3)).toBe(1);
    expect(fake.accepted.map(([n]) => n).sort()).toEqual([1, 2, 3]);
  });

  it("asks for a fresh URL batch when a presigned URL has expired (403)", async () => {
    const file = fileOf(12 * MIB);
    useFakeBackend(file.size);
    fake.expiredFirstUrl.add(3);

    await startUpload({ file, created: created(file.size), retryDelayMs: 1 }).done;

    expect(fake.presignBatches.length).toBeGreaterThanOrEqual(2);
    expect(fake.presignBatches.at(-1)).toContain(3);
    expect(fake.accepted.map(([n]) => n).sort()).toEqual([1, 2, 3]);
  });

  it("gives up after the retries are exhausted and does not call complete", async () => {
    const file = fileOf(2 * MIB);
    useFakeBackend(file.size);
    server.use(
      http.put(`${STORAGE}/videos/:publicId/source`, () => new HttpResponse(null, { status: 500 }))
    );

    const handle = startUpload({ file, created: created(file.size), retryDelayMs: 1 });

    await expect(handle.done).rejects.toBeInstanceOf(UploadError);
    expect(fake.completeBody).toBeNull();
  });

  it("cancel() aborts the in-flight PUTs and aborts the session (the draft is gone)", async () => {
    const file = fileOf(12 * MIB);
    useFakeBackend(file.size);
    fake.hangPuts = true;

    const handle = startUpload({ file, created: created(file.size) });
    await expect.poll(() => fake.inFlight).toBeGreaterThan(0);
    await handle.cancel();

    await expect(handle.done).rejects.toBeInstanceOf(UploadCancelledError);
    expect(fake.completeBody).toBeNull();
    const state = await fetch(`/api/videos/${PUBLIC_ID}/upload`);
    expect(state.status).toBe(404);
  });
});

describe("startUpload — UPLOAD_INCOMPLETE", () => {
  it("re-syncs with GET …/upload, resends only the missing part and completes", async () => {
    const file = fileOf(12 * MIB);
    useFakeBackend(file.size);
    let completes = 0;
    server.use(
      http.post("/api/videos/:publicId/upload/complete", async ({ request }) => {
        completes += 1;
        if (completes === 1) {
          // The storage lost part 3: only parts 1 and 2 are listed by the session.
          fake.uploadedParts = [
            { part_number: 1, etag: '"etag-1"', size: PART_SIZE },
            { part_number: 2, etag: '"etag-2"', size: PART_SIZE },
          ];
          return HttpResponse.json(
            { statusCode: 422, error: "UPLOAD_INCOMPLETE", message: "Missing parts" },
            { status: 422 }
          );
        }
        fake.completeBody = await request.json();
        return HttpResponse.json(
          { public_id: PUBLIC_ID, status: "draft", processing_status: "processing", size_bytes: file.size },
          { status: 202 }
        );
      })
    );

    await startUpload({ file, created: created(file.size), retryDelayMs: 1 }).done;

    expect(completes).toBe(2);
    expect(fake.putAttempts.get(3)).toBe(2);
    expect(fake.putAttempts.get(1)).toBe(1);
    expect(fake.presignBatches.at(-1)).toEqual([3]);
    expect((fake.completeBody as { parts: unknown[] }).parts).toHaveLength(3);
  });
});

describe("resumeUpload", () => {
  it("skips the parts the storage already accepted", async () => {
    const file = fileOf(12 * MIB);
    useFakeBackend(file.size);
    fake.uploadedParts = [{ part_number: 1, etag: '"etag-1"', size: PART_SIZE }];
    const progress: number[] = [];

    await resumeUpload({
      file,
      publicId: PUBLIC_ID,
      onProgress: ({ uploadedBytes }) => progress.push(uploadedBytes),
    }).done;

    expect(fake.putAttempts.has(1)).toBe(false);
    expect(fake.presignBatches).toEqual([[2, 3]]);
    expect(progress[0]).toBe(5 * MIB);
    expect(fake.completeBody).toEqual({
      parts: [
        { part_number: 1, etag: '"etag-1"' },
        { part_number: 2, etag: '"etag-2"' },
        { part_number: 3, etag: '"etag-3"' },
      ],
    });
  });

  it("refuses a file whose size does not match the session", async () => {
    useFakeBackend(12 * MIB);

    const handle = resumeUpload({ file: fileOf(3 * MIB), publicId: PUBLIC_ID });

    await expect(handle.done).rejects.toMatchObject({ code: "UPLOAD_FILE_MISMATCH" });
  });

  it("fails with UPLOAD_NOT_ACTIVE when the session is no longer active", async () => {
    const file = fileOf(2 * MIB);
    useFakeBackend(file.size);
    fake.state = "completed";

    await expect(resumeUpload({ file, publicId: PUBLIC_ID }).done).rejects.toMatchObject({
      code: "UPLOAD_NOT_ACTIVE",
    });
  });
});
