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
  toVideoCardItem,
} from "../factories/videos";
import {
  READS_UNTIL_READY,
  STORAGE_DOWN_ID,
  createVideoEntry,
  studioStore,
  type UploadEntry,
  type VideoEntry,
} from "../store";
import { apiError, requireBearer } from "./_http";
import {
  channelView,
  invalidReaction,
  isSignedIn,
  reactionDelta,
  readReactionValue,
} from "./_social";

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
type RelatedOk =
  paths["/videos/{publicId}/related"]["get"]["responses"][200]["content"]["application/json"];
type UploadCompletedOk =
  paths["/videos/{publicId}/upload/complete"]["post"]["responses"][202]["content"]["application/json"];

type ReactionStateOk =
  paths["/videos/{publicId}/reaction"]["put"]["responses"][200]["content"]["application/json"];

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
// `GET /videos/{id}/related`: padrão e teto de `limit` (watch-page/TD-04).
const RELATED_DEFAULT_LIMIT = 12;
const RELATED_MAX_LIMIT = 24;
const UPLOAD_EXPIRES_AT = "2026-10-02T12:00:00.000Z";
// Playback URLs stay valid in the fixtures: the watch page player renews an expired URL before
// playing, and the E2E runs against the real clock.
const PLAYBACK_EXPIRES_AT = "2099-01-01T00:00:00.000Z";

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
  if (!entry) {
    return { error: videoNotFound() };
  }
  // Vídeo de outro canal (`tech_mastery`): lê como público, nunca muta.
  return entry.owner && access === "write"
    ? { error: videoForbidden() }
    : { entry };
}

/**
 * Regra de leitura pública (video-channel-management/TD-07): todo vídeo do store é do canal
 * do usuário logado, então com `Bearer` lê qualquer status; anônimo só lê `published`.
 */
function resolveReadable(
  publicId: string,
  request: Request,
): { entry: VideoEntry } | { error: Response } {
  const found = resolveVideo(publicId, "read");
  if ("error" in found || isOwner(request)) {
    return found;
  }
  return found.entry.video.status === "published"
    ? found
    : { error: videoNotFound() };
}

function isOwner(request: Request): boolean {
  return (request.headers.get("authorization") ?? "").startsWith("Bearer ");
}

/**
 * Resposta de `VideoResponse` com o canal dono atual (o nickname do store pode ter mudado) e o
 * estado do espectador (Fase 06). Sem `request` (respostas do estúdio) sai como anônimo, como no
 * backend.
 */
function present(entry: VideoEntry, request?: Request): VideoOk {
  const viewerRequest = request ?? new Request(env.API_URL);
  const owner = channelView(
    entry.owner ?? studioStore().channel.nickname,
    viewerRequest,
  );
  if (!owner) {
    throw new Error(`Fixture video ${entry.video.public_id} has no channel`);
  }
  return {
    ...entry.video,
    viewer_reaction: isSignedIn(viewerRequest)
      ? (studioStore().social.videoReactions.get(entry.video.public_id) ?? null)
      : null,
    channel: owner.channel,
  };
}

/** Mesma seleção do backend: só `published` + `public` + `ready`, a mesma categoria primeiro. */
function relatedTo(origin: VideoEntry, limit: number): RelatedOk {
  const { channel, videos } = studioStore();
  const categoryId = origin.video.category?.id ?? null;
  const byRecency = (a: VideoEntry, b: VideoEntry) =>
    (b.video.published_at ?? "").localeCompare(a.video.published_at ?? "");
  const eligible = [...videos.values()]
    .filter(
      (entry) =>
        !entry.hidden &&
        entry !== origin &&
        entry.video.status === "published" &&
        entry.video.visibility === "public" &&
        entry.video.processing_status === "ready",
    )
    .sort(byRecency);
  const same = categoryId
    ? eligible.filter((entry) => entry.video.category?.id === categoryId)
    : [];
  const others = eligible.filter((entry) => !same.includes(entry));
  return {
    items: [...same, ...others]
      .slice(0, limit)
      .map((entry) => toVideoCardItem(entry.video, channel)),
  };
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
  http.get<VideoParams>(
    `${env.API_URL}/videos/:publicId`,
    ({ params, request }) => {
      const found = resolveReadable(params.publicId, request);
      if ("error" in found) {
        return found.error;
      }
      advanceProcessing(found.entry);
      return HttpResponse.json<VideoOk>(present(found.entry, request));
    },
  ),

  // GET /videos/:publicId/related — sugestões da watch page, lista fechada `{ items }`
  http.get<VideoParams>(
    `${env.API_URL}/videos/:publicId/related`,
    ({ params, request }) => {
      const raw = new URL(request.url).searchParams.get("limit");
      const limit = raw === null ? RELATED_DEFAULT_LIMIT : Number(raw);
      if (!Number.isInteger(limit) || limit < 1 || limit > RELATED_MAX_LIMIT) {
        return apiError(
          400,
          "VALIDATION_ERROR",
          `limit must be an integer between 1 and ${RELATED_MAX_LIMIT}`,
        );
      }
      const found = resolveReadable(params.publicId, request);
      if ("error" in found) {
        return found.error;
      }
      return HttpResponse.json<RelatedOk>(relatedTo(found.entry, limit));
    },
  ),

  // POST /videos/:publicId/views — 204 sempre; conta 1x por espectador anônimo em vídeo publicado
  http.post<VideoParams>(
    `${env.API_URL}/videos/:publicId/views`,
    ({ params, request }) => {
      const found = resolveReadable(params.publicId, request);
      if ("error" in found) {
        return found.error;
      }
      const { entry } = found;
      // O dono (qualquer `Bearer` no fake) não conta, como no backend.
      const viewer = request.headers.get("x-forwarded-for") ?? "anonymous";
      const key = `${params.publicId}|${viewer}`;
      const { countedViews } = studioStore();
      if (
        entry.video.status === "published" &&
        !isOwner(request) &&
        !countedViews.has(key)
      ) {
        countedViews.add(key);
        entry.video = {
          ...entry.video,
          view_count: entry.video.view_count + 1,
        };
      }
      return new HttpResponse(null, { status: 204 });
    },
  ),

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
      return HttpResponse.json<VideoOk>(present(found.entry));
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
    ({ params, request }) => {
      const found = resolveReadable(params.publicId, request);
      if ("error" in found) {
        return found.error;
      }
      if (params.publicId === STORAGE_DOWN_ID) {
        return apiError(
          503,
          "STORAGE_UNAVAILABLE",
          "Object storage is unavailable",
        );
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
        expires_at: PLAYBACK_EXPIRES_AT,
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
      return HttpResponse.json<VideoOk>(present(found.entry));
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
      return HttpResponse.json<VideoOk>(present(found.entry));
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
      return HttpResponse.json<VideoOk>(present(found.entry));
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

  // PUT /videos/:publicId/reaction — set-state idempotente; só `published` (TD-03)
  http.put<VideoParams>(
    `${env.API_URL}/videos/:publicId/reaction`,
    async ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const value = await readReactionValue(request);
      if (value === null) {
        return invalidReaction();
      }
      return writeVideoReaction(params.publicId, value);
    },
  ),

  // DELETE /videos/:publicId/reaction — sem reação, mesmo estado sem efeito
  http.delete<VideoParams>(
    `${env.API_URL}/videos/:publicId/reaction`,
    ({ params, request }) => {
      const unauthorized = requireBearer(request);
      return unauthorized ?? writeVideoReaction(params.publicId, null);
    },
  ),
];

/**
 * Aplica a reação do usuário do store e devolve o `ReactionState` (TD-02/TD-03). Rascunho ou
 * processamento → 404, inclusive para o dono (TD-03, Revisions 2026-10-20).
 */
function writeVideoReaction(
  publicId: string,
  next: "like" | "dislike" | null,
): Response {
  const found = resolveVideo(publicId, "read");
  if ("error" in found) {
    return found.error;
  }
  const { entry } = found;
  if (entry.video.status !== "published") {
    return videoNotFound();
  }
  const reactions = studioStore().social.videoReactions;
  const delta = reactionDelta(reactions.get(publicId) ?? null, next);
  if (next === null) {
    reactions.delete(publicId);
  } else {
    reactions.set(publicId, next);
  }
  entry.video = {
    ...entry.video,
    like_count: entry.video.like_count + delta.like,
    dislike_count: entry.video.dislike_count + delta.dislike,
  };
  return HttpResponse.json<ReactionStateOk>({
    viewer_reaction: next,
    like_count: entry.video.like_count,
    dislike_count: entry.video.dislike_count,
  });
}
