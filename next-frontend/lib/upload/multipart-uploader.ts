import type {
  ApiErrorEnvelope,
  PresignedParts,
  UploadCompleted,
  UploadState,
  VideoCreated,
} from "@/lib/api/contracts";

/**
 * Cliente do protocolo multipart da Fase 03 no navegador (video-channel-management/TD-11;
 * phase-03-videos/TD-03). As chamadas à API passam pelo BFF (`/api/videos/**`); só os
 * `PUT` das partes vão direto às URLs presignadas do storage (`S3_PUBLIC_ENDPOINT`) — a única
 * exceção ao Strict BFF.
 */

/** Máximo de partes pedidas por `POST …/upload/parts` (limite do DTO no backend). */
export const PRESIGN_BATCH_SIZE = 100;
/** `PUT`s de parte simultâneos. */
export const MAX_CONCURRENT_PARTS = 4;
/** Novas tentativas por parte depois da primeira falha. */
export const PART_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1_000;

export type UploadProgress = { uploadedBytes: number; totalBytes: number };

export type UploadHandle = {
  /** Resolve com o 202 do `complete`; rejeita com `UploadError` ou `UploadCancelledError`. */
  done: Promise<UploadCompleted>;
  progress: () => UploadProgress;
  /** Interrompe os `PUT` em andamento e aborta a sessão multipart (`DELETE …/upload`). */
  cancel: () => Promise<void>;
};

type UploadOptions = {
  file: Blob;
  onProgress?: (progress: UploadProgress) => void;
  /** Base do backoff exponencial entre tentativas de uma parte (testes usam valores pequenos). */
  retryDelayMs?: number;
};

export type StartUploadOptions = UploadOptions & { created: VideoCreated };
export type ResumeUploadOptions = UploadOptions & { publicId: string };

/** Falha do upload: envelope da API (`code`) ou erro do storage/rede. */
export class UploadError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number | null = null
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
  }
}

type Session = {
  publicId: string;
  partSize: number;
  partCount: number;
  /** ETags das partes já aceitas pelo storage (retomada ou concluídas nesta execução). */
  etags: Map<number, string>;
};

const api = (publicId: string, suffix = "") =>
  `/api/videos/${encodeURIComponent(publicId)}/upload${suffix}`;

async function failure(response: Response): Promise<UploadError> {
  const envelope = (await response.json().catch(() => null)) as ApiErrorEnvelope | null;
  const message = Array.isArray(envelope?.message)
    ? envelope.message.join("; ")
    : (envelope?.message ?? `Request failed with status ${response.status}`);
  return new UploadError(message, envelope?.error ?? "UPLOAD_FAILED", response.status);
}

async function postJson<T>(url: string, body: unknown, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    throw await failure(response);
  }
  return (await response.json()) as T;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new UploadCancelledError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new UploadCancelledError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function partRange(session: Session, file: Blob, partNumber: number): [number, number] {
  const start = (partNumber - 1) * session.partSize;
  return [start, Math.min(start + session.partSize, file.size)];
}

function run(
  sessionPromise: Promise<Session>,
  { file, onProgress, retryDelayMs = DEFAULT_RETRY_DELAY_MS }: UploadOptions
): UploadHandle {
  const controller = new AbortController();
  const { signal } = controller;
  let publicId: string | null = null;
  let uploadedBytes = 0;

  const progress = (): UploadProgress => ({ uploadedBytes, totalBytes: file.size });
  const report = () => onProgress?.(progress());

  async function presign(partNumbers: number[]): Promise<Map<number, string>> {
    const { parts } = await postJson<PresignedParts>(
      api(publicId!, "/parts"),
      { part_numbers: partNumbers },
      signal
    );
    return new Map(parts.map((part) => [part.part_number, part.url]));
  }

  async function putPart(
    session: Session,
    partNumber: number,
    urls: Map<number, string>,
    batch: number[]
  ): Promise<void> {
    const [start, end] = partRange(session, file, partNumber);
    for (let attempt = 0; ; attempt += 1) {
      let error: UploadError;
      try {
        const response = await fetch(urls.get(partNumber)!, {
          method: "PUT",
          body: file.slice(start, end),
          signal,
        });
        const etag = response.headers.get("ETag");
        if (response.ok && etag) {
          session.etags.set(partNumber, etag);
          uploadedBytes += end - start;
          report();
          return;
        }
        error = new UploadError(
          response.ok
            ? `Storage did not expose the ETag of part ${partNumber}`
            : `Storage rejected part ${partNumber} (${response.status})`,
          "STORAGE_PART_FAILED",
          response.status
        );
        // URL presignada expirada: repede o lote ainda pendente antes de tentar de novo.
        if (response.status === 403) {
          const pending = batch.filter((n) => !session.etags.has(n));
          for (const [n, url] of await presign(pending)) {
            urls.set(n, url);
          }
        }
      } catch (cause) {
        if (signal.aborted) {
          throw new UploadCancelledError();
        }
        if (cause instanceof UploadError) {
          throw cause; // falha da API ao repedir URLs — não é transitória da parte
        }
        error = new UploadError(
          `Network error while sending part ${partNumber}`,
          "STORAGE_PART_FAILED"
        );
      }
      if (attempt >= PART_RETRIES) {
        throw error;
      }
      await wait(retryDelayMs * 2 ** attempt, signal);
    }
  }

  async function uploadBatch(session: Session, batch: number[]): Promise<void> {
    const urls = await presign(batch);
    const queue = [...batch];
    const worker = async () => {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
        await putPart(session, next, urls, batch);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENT_PARTS, batch.length) }, worker)
    );
  }

  async function execute(): Promise<UploadCompleted> {
    const session = await sessionPromise;
    publicId = session.publicId;
    for (const partNumber of session.etags.keys()) {
      const [start, end] = partRange(session, file, partNumber);
      uploadedBytes += end - start;
    }
    report();

    const pending = Array.from({ length: session.partCount }, (_, i) => i + 1).filter(
      (n) => !session.etags.has(n)
    );
    for (let i = 0; i < pending.length; i += PRESIGN_BATCH_SIZE) {
      await uploadBatch(session, pending.slice(i, i + PRESIGN_BATCH_SIZE));
    }

    try {
      return await complete(session);
    } catch (error) {
      if (!(error instanceof UploadError) || error.code !== "UPLOAD_INCOMPLETE") {
        throw error;
      }
    }
    // 422 UPLOAD_INCOMPLETE: o storage não tem todas as partes. Ressincroniza pelo
    // `GET …/upload`, reenvia só as que faltam e tenta o `complete` mais uma vez.
    await resync(session);
    return complete(session);
  }

  async function complete(session: Session): Promise<UploadCompleted> {
    const parts = [...session.etags.entries()]
      .sort(([a], [b]) => a - b)
      .map(([part_number, etag]) => ({ part_number, etag }));
    const response = await fetch(api(session.publicId, "/complete"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parts }),
      signal,
    });
    if (response.status !== 202) {
      throw await failure(response);
    }
    return (await response.json()) as UploadCompleted;
  }

  async function resync(session: Session): Promise<void> {
    const response = await fetch(api(session.publicId), { signal });
    if (!response.ok) {
      throw await failure(response);
    }
    const state = (await response.json()) as UploadState;
    const accepted = new Map(state.uploaded_parts.map((part) => [part.part_number, part.etag]));
    session.etags = accepted;
    uploadedBytes = 0;
    for (const partNumber of accepted.keys()) {
      const [start, end] = partRange(session, file, partNumber);
      uploadedBytes += end - start;
    }
    report();
    const missing = Array.from({ length: session.partCount }, (_, i) => i + 1).filter(
      (n) => !accepted.has(n)
    );
    for (let i = 0; i < missing.length; i += PRESIGN_BATCH_SIZE) {
      await uploadBatch(session, missing.slice(i, i + PRESIGN_BATCH_SIZE));
    }
  }

  const done = execute().catch((error: unknown) => {
    throw signal.aborted ? new UploadCancelledError() : error;
  });

  async function cancel(): Promise<void> {
    controller.abort();
    await done.catch(() => undefined);
    const target = publicId ?? (await sessionPromise.then((s) => s.publicId).catch(() => null));
    if (target === null) {
      return;
    }
    const response = await fetch(api(target), { method: "DELETE" });
    // 409: a sessão já não estava ativa (concluída ou abortada) — nada a desfazer.
    if (!response.ok && response.status !== 409) {
      throw await failure(response);
    }
  }

  return { done, progress, cancel };
}

/** Envia o arquivo de uma sessão recém-aberta por `POST /api/videos`. */
export function startUpload({ created, ...options }: StartUploadOptions): UploadHandle {
  const { upload } = created;
  return run(
    Promise.resolve({
      publicId: created.public_id,
      partSize: upload.part_size,
      partCount: upload.part_count,
      etags: new Map(),
    }),
    options
  );
}

/**
 * Retoma uma sessão ainda ativa (ex.: depois de recarregar a página) com o mesmo arquivo:
 * `GET …/upload` diz quais partes o storage já aceitou e só as restantes são enviadas.
 */
export function resumeUpload({ publicId, ...options }: ResumeUploadOptions): UploadHandle {
  const session = (async (): Promise<Session> => {
    const response = await fetch(api(publicId));
    if (!response.ok) {
      throw await failure(response);
    }
    const state = (await response.json()) as UploadState;
    if (state.state !== "active") {
      throw new UploadError(
        `Upload session is not active (state: ${state.state})`,
        "UPLOAD_NOT_ACTIVE",
        409
      );
    }
    if (state.expected_bytes !== options.file.size) {
      throw new UploadError(
        "The selected file does not match the interrupted upload",
        "UPLOAD_FILE_MISMATCH"
      );
    }
    return {
      publicId,
      partSize: state.part_size,
      partCount: state.part_count,
      etags: new Map(state.uploaded_parts.map((part) => [part.part_number, part.etag])),
    };
  })();
  return run(session, options);
}
