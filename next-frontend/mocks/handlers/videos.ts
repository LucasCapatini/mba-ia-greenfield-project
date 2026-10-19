import { http, HttpResponse } from "msw";

import type { paths } from "@/lib/api/types.gen";
import { env } from "@/lib/env";

import {
  CATEGORIES,
  FIXTURE_NOW,
  STORAGE_BUCKET,
  STORAGE_PUBLIC_ORIGIN,
  buildUnprocessedVideo,
  thumbnailUrl,
} from "../factories/videos";
import {
  READS_UNTIL_READY,
  createVideoEntry,
  studioStore,
  type UploadEntry,
  type VideoEntry,
} from "../store";
import { apiError, requireBearer } from "./_http";

type VideoOk =
  paths["/videos/{publicId}"]["get"]["responses"][200]["content"]["application/json"];
type UpdateVideoBody =
  paths["/videos/{publicId}"]["patch"]["requestBody"]["content"]["application/json"];
type PlaybackOk =
  paths["/videos/{publicId}/playback"]["get"]["responses"][200]["content"]["application/json"];
type CreateVideoBody =
  paths["/videos"]["post"]["requestBody"]["content"]["application/json"];
type VideoCreatedOk =
  paths["/videos"]["post"]["responses"][201]["content"]["application/json"];
type PresignPartsBody =
  paths["/videos/{publicId}/upload/parts"]["post"]["requestBody"]["content"]["application/json"];
type PresignPartsOk =
  paths["/videos/{publicId}/upload/parts"]["post"]["responses"][200]["content"]["application/json"];
type UploadStateOk =
  paths["/videos/{publicId}/upload"]["get"]["responses"][200]["content"]["application/json"];
type UploadCompletedOk =
  paths["/videos/{publicId}/upload/complete"]["post"]["responses"][202]["content"]["application/json"];

type VideoParams = { publicId: string };

// Reserved trigger table (shared with E2E — trigger values must not collide across test suites).
// `processing-id` vive no store (oculto da listagem) e nunca sai de `processing`.
const NOT_FOUND_ID = "notfound-id";
const FORBIDDEN_ID = "forbidden-id";
// Rascunho de outro canal: leitura → 404 (não revela rascunho alheio), mutação → 403.
const OTHER_CHANNEL_ID = "other-channel-01";
// `public_id` que `POST /videos` sempre devolve (specs `studio-upload*`).
export const NEW_UPLOAD_ID = "new-upload-id";

export const PART_SIZE = 5_242_880;
const UPLOAD_EXPIRES_AT = "2026-10-02T12:00:00.000Z";

const videoNotFound = () => apiError(404, "VIDEO_NOT_FOUND", "Video not found");
const videoForbidden = () =>
  apiError(403, "VIDEO_FORBIDDEN", "You do not own this video");
const uploadNotActive = (state: string) =>
  apiError(
    409,
    "UPLOAD_NOT_ACTIVE",
    `Upload session is not active (state: ${state})`,
  );

/** Resolve o vídeo do store aplicando os triggers reservados e a regra de dono. */
function resolveVideo(
  publicId: string,
  access: "read" | "write",
): { entry: VideoEntry } | { error: Response } {
  if (publicId === NOT_FOUND_ID) {
    return { error: videoNotFound() };
  }
  if (publicId === FORBIDDEN_ID) {
    return { error: videoForbidden() };
  }
  if (publicId === OTHER_CHANNEL_ID) {
    return { error: access === "read" ? videoNotFound() : videoForbidden() };
  }
  const entry = studioStore().videos.get(publicId);
  return entry ? { entry } : { error: videoNotFound() };
}

function markReady(entry: VideoEntry): void {
  entry.readsUntilReady = null;
  entry.video = {
    ...entry.video,
    processing_status: "ready",
    duration_seconds: 125,
    width: 1920,
    height: 1080,
    container: entry.video.content_type === "video/webm" ? "webm" : "mp4",
    video_codec: "h264",
    audio_codec: "aac",
    thumbnail_url: thumbnailUrl(entry.video.public_id, entry.thumbnailVersion),
    processed_at: FIXTURE_NOW,
  };
}

/** Cada leitura consome uma das `READS_UNTIL_READY` respostas em `processing`. */
function advanceProcessing(entry: VideoEntry): void {
  if (entry.readsUntilReady === null) {
    return;
  }
  if (entry.readsUntilReady > 0) {
    entry.readsUntilReady -= 1;
    return;
  }
  markReady(entry);
}

/** Igual a `deriveVideoTitle` do backend: tira só a última extensão. */
function titleFromFilename(filename: string): string {
  const trimmed = filename.trim();
  const withoutExtension = trimmed.replace(/\.[^.]*$/, "").trim();
  const base = withoutExtension.length > 0 ? withoutExtension : trimmed;
  return Array.from(base).slice(0, 100).join("");
}

/** Uploads semeados (sem sessão própria) já foram concluídos. */
function uploadOf(entry: VideoEntry): UploadEntry {
  return (
    entry.upload ?? {
      upload_id: `upload-${entry.video.public_id}`,
      part_size: PART_SIZE,
      part_count: 1,
      expected_bytes: entry.video.size_bytes ?? 0,
      state: "completed",
    }
  );
}

function bumpThumbnail(entry: VideoEntry, custom: boolean): void {
  entry.thumbnailVersion += 1;
  entry.video = {
    ...entry.video,
    has_custom_thumbnail: custom,
    thumbnail_url: thumbnailUrl(
      entry.video.public_id,
      entry.thumbnailVersion,
      custom ? "custom" : "auto",
    ),
  };
}

export const handlers = [
  // POST /videos — cria o rascunho e a sessão multipart (sempre `new-upload-id`)
  http.post(`${env.API_URL}/videos`, async ({ request }) => {
    const unauthorized = requireBearer(request);
    if (unauthorized) {
      return unauthorized;
    }
    const body = (await request.json()) as CreateVideoBody;
    const partCount = Math.max(1, Math.ceil(body.size_bytes / PART_SIZE));
    const upload: UploadEntry = {
      upload_id: `upload-${NEW_UPLOAD_ID}`,
      part_size: PART_SIZE,
      part_count: partCount,
      expected_bytes: body.size_bytes,
      state: "active",
    };
    createVideoEntry(
      buildUnprocessedVideo("uploading", {
        public_id: NEW_UPLOAD_ID,
        title: titleFromFilename(body.original_filename),
        original_filename: body.original_filename,
        content_type: body.content_type,
        size_bytes: null,
        // Mais novo que todo o seed — topo da ordenação `latest`.
        created_at: new Date(Date.parse(FIXTURE_NOW) + 60_000).toISOString(),
      }),
      upload,
    );
    return HttpResponse.json<VideoCreatedOk>(
      {
        public_id: NEW_UPLOAD_ID,
        status: "draft",
        processing_status: "uploading",
        upload: {
          upload_id: upload.upload_id,
          part_size: upload.part_size,
          part_count: upload.part_count,
          expires_at: UPLOAD_EXPIRES_AT,
        },
      },
      { status: 201 },
    );
  }),

  // GET /videos/:publicId — avança `processing` → `ready` nos vídeos que têm leituras pendentes
  http.get<VideoParams>(`${env.API_URL}/videos/:publicId`, ({ params }) => {
    const found = resolveVideo(params.publicId, "read");
    if ("error" in found) {
      return found.error;
    }
    advanceProcessing(found.entry);
    return HttpResponse.json<VideoOk>(found.entry.video);
  }),

  // PATCH /videos/:publicId
  http.patch<VideoParams>(
    `${env.API_URL}/videos/:publicId`,
    async ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const found = resolveVideo(params.publicId, "write");
      if ("error" in found) {
        return found.error;
      }
      const body = (await request.json()) as UpdateVideoBody;
      const { video } = found.entry;
      let category = video.category;
      if (body.category_id !== undefined) {
        category =
          body.category_id === null
            ? null
            : (CATEGORIES.find((item) => item.id === body.category_id) ?? null);
        if (body.category_id !== null && category === null) {
          return apiError(
            400,
            "CATEGORY_NOT_FOUND",
            `Category ${body.category_id} does not exist`,
          );
        }
      }
      found.entry.video = {
        ...video,
        title: body.title ?? video.title,
        description:
          body.description === undefined ? video.description : body.description,
        visibility: body.visibility ?? video.visibility,
        category,
      };
      return HttpResponse.json<VideoOk>(found.entry.video);
    },
  ),

  // DELETE /videos/:publicId
  http.delete<VideoParams>(
    `${env.API_URL}/videos/:publicId`,
    ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const found = resolveVideo(params.publicId, "write");
      if ("error" in found) {
        return found.error;
      }
      studioStore().videos.delete(params.publicId);
      return new HttpResponse(null, { status: 204 });
    },
  ),

  // GET /videos/:publicId/playback
  http.get<VideoParams>(
    `${env.API_URL}/videos/:publicId/playback`,
    ({ params }) => {
      const found = resolveVideo(params.publicId, "read");
      if ("error" in found) {
        return found.error;
      }
      const { video } = found.entry;
      if (video.processing_status !== "ready") {
        return apiError(
          409,
          "VIDEO_NOT_READY",
          `Video is not ready for playback (processing_status: ${video.processing_status})`,
        );
      }
      const source = `${STORAGE_PUBLIC_ORIGIN}/${STORAGE_BUCKET}/videos/${video.public_id}/source`;
      return HttpResponse.json<PlaybackOk>({
        stream_url: `${source}?X-Amz-Signature=stream`,
        download_url: `${source}?X-Amz-Signature=download`,
        thumbnail_url: video.thumbnail_url,
        expires_at: UPLOAD_EXPIRES_AT,
      });
    },
  ),

  // POST /videos/:publicId/publish — exige `ready` e título
  http.post<VideoParams>(
    `${env.API_URL}/videos/:publicId/publish`,
    ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const found = resolveVideo(params.publicId, "write");
      if ("error" in found) {
        return found.error;
      }
      const { video } = found.entry;
      if (video.processing_status !== "ready") {
        return apiError(
          409,
          "VIDEO_NOT_PUBLISHABLE",
          `Video cannot be published: processing_status is ${video.processing_status}`,
        );
      }
      if (video.title.trim() === "") {
        return apiError(
          409,
          "VIDEO_NOT_PUBLISHABLE",
          "Video cannot be published: title is empty",
        );
      }
      found.entry.video = {
        ...video,
        status: "published",
        published_at: video.published_at ?? FIXTURE_NOW,
      };
      return HttpResponse.json<VideoOk>(found.entry.video);
    },
  ),

  // POST /videos/:publicId/unpublish — preserva `visibility` e `published_at`
  http.post<VideoParams>(
    `${env.API_URL}/videos/:publicId/unpublish`,
    ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const found = resolveVideo(params.publicId, "write");
      if ("error" in found) {
        return found.error;
      }
      found.entry.video = { ...found.entry.video, status: "draft" };
      return HttpResponse.json<VideoOk>(found.entry.video);
    },
  ),

  // PUT /videos/:publicId/thumbnail — a validação de tamanho/tipo fica no cliente e no BFF
  http.put<VideoParams>(
    `${env.API_URL}/videos/:publicId/thumbnail`,
    ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const found = resolveVideo(params.publicId, "write");
      if ("error" in found) {
        return found.error;
      }
      bumpThumbnail(found.entry, true);
      return HttpResponse.json<VideoOk>(found.entry.video);
    },
  ),

  // DELETE /videos/:publicId/thumbnail — volta para a automática
  http.delete<VideoParams>(
    `${env.API_URL}/videos/:publicId/thumbnail`,
    ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const found = resolveVideo(params.publicId, "write");
      if ("error" in found) {
        return found.error;
      }
      bumpThumbnail(found.entry, false);
      return new HttpResponse(null, { status: 204 });
    },
  ),

  // POST /videos/:publicId/upload/parts — URLs na origem pública do storage
  http.post<VideoParams>(
    `${env.API_URL}/videos/:publicId/upload/parts`,
    async ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const found = resolveVideo(params.publicId, "write");
      if ("error" in found) {
        return found.error;
      }
      const upload = uploadOf(found.entry);
      if (upload.state !== "active") {
        return uploadNotActive(upload.state);
      }
      const body = (await request.json()) as PresignPartsBody;
      const source = `${STORAGE_PUBLIC_ORIGIN}/${STORAGE_BUCKET}/videos/${params.publicId}/source`;
      return HttpResponse.json<PresignPartsOk>({
        upload_id: upload.upload_id,
        part_size: upload.part_size,
        expires_at: UPLOAD_EXPIRES_AT,
        parts: body.part_numbers.map((partNumber) => ({
          part_number: partNumber,
          url: `${source}?partNumber=${partNumber}&uploadId=${upload.upload_id}`,
        })),
      });
    },
  ),

  // GET /videos/:publicId/upload — estado da sessão (sem partes registradas no fake)
  http.get<VideoParams>(
    `${env.API_URL}/videos/:publicId/upload`,
    ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const found = resolveVideo(params.publicId, "write");
      if ("error" in found) {
        return found.error;
      }
      const upload = uploadOf(found.entry);
      return HttpResponse.json<UploadStateOk>({
        upload_id: upload.upload_id,
        state: upload.state,
        part_size: upload.part_size,
        part_count: upload.part_count,
        expected_bytes: upload.expected_bytes,
        expires_at: UPLOAD_EXPIRES_AT,
        uploaded_parts: [],
      });
    },
  ),

  // DELETE /videos/:publicId/upload — aborta e remove o rascunho, como o backend
  http.delete<VideoParams>(
    `${env.API_URL}/videos/:publicId/upload`,
    ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const found = resolveVideo(params.publicId, "write");
      if ("error" in found) {
        return found.error;
      }
      const upload = uploadOf(found.entry);
      if (upload.state !== "active") {
        return uploadNotActive(upload.state);
      }
      studioStore().videos.delete(params.publicId);
      return new HttpResponse(null, { status: 204 });
    },
  ),

  // POST /videos/:publicId/upload/complete — `processing` por READS_UNTIL_READY leituras
  http.post<VideoParams>(
    `${env.API_URL}/videos/:publicId/upload/complete`,
    ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const found = resolveVideo(params.publicId, "write");
      if ("error" in found) {
        return found.error;
      }
      const { entry } = found;
      const upload = uploadOf(entry);
      if (upload.state !== "active") {
        return uploadNotActive(upload.state);
      }
      entry.upload = { ...upload, state: "completed" };
      entry.readsUntilReady = READS_UNTIL_READY;
      entry.video = {
        ...entry.video,
        processing_status: "processing",
        size_bytes: upload.expected_bytes,
      };
      return HttpResponse.json<UploadCompletedOk>(
        {
          public_id: entry.video.public_id,
          status: entry.video.status,
          processing_status: "processing",
          size_bytes: upload.expected_bytes,
        },
        { status: 202 },
      );
    },
  ),
];
