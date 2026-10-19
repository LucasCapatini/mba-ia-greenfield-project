import type {
  ApiErrorEnvelope,
  UpdateVideoRequest,
  Video,
  VideoUpdateResult,
} from "@/lib/api/contracts";
import {
  invalidBody,
  readJson,
  withSession,
  type PublicIdContext,
} from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// GET /api/videos/{publicId} → GET /videos/{publicId} — usado pelo polling de processamento
// (useProcessingPoll, per video-channel-management/TD-12).
export async function GET(_request: Request, { params }: PublicIdContext) {
  const { publicId } = await params;
  return withSession((headers) =>
    upstream.GET("/videos/{publicId}", {
      params: { path: { publicId } },
      headers,
    })
  );
}

function isPublishable(video: Video): boolean {
  return (
    video.status === "draft" &&
    video.processing_status === "ready" &&
    video.title.trim() !== ""
  );
}

// PATCH /api/videos/{publicId} → PATCH /videos/{publicId} e, quando o vídeo salvo é um rascunho
// pronto com título e o corpo não traz `publish: false`, POST /videos/{publicId}/publish
// (per video-channel-management/TD-03, Revisions 2026-10-18). Responde `{ video, published }`.
export async function PATCH(request: Request, { params }: PublicIdContext) {
  const { publicId } = await params;
  const body = await readJson<UpdateVideoRequest>(request);
  if (body === null) {
    return invalidBody();
  }
  // `publish` é só do BFF — o upstream rejeita campos fora do DTO (forbidNonWhitelisted).
  const { publish, ...changes } = body;

  const saved = await withSession((headers) =>
    upstream.PATCH("/videos/{publicId}", {
      params: { path: { publicId } },
      body: changes,
      headers,
    })
  );
  if (!saved.ok) {
    return saved;
  }
  const video = (await saved.json()) as Video;
  if (publish === false || !isPublishable(video)) {
    return Response.json({ video, published: false } satisfies VideoUpdateResult);
  }

  const published = await withSession((headers) =>
    upstream.POST("/videos/{publicId}/publish", {
      params: { path: { publicId } },
      headers,
    })
  );
  if (published.ok) {
    const publishedVideo = (await published.json()) as Video;
    return Response.json({
      video: publishedVideo,
      published: true,
    } satisfies VideoUpdateResult);
  }
  if (published.status === 409) {
    const envelope = (await published.clone().json()) as ApiErrorEnvelope;
    if (envelope.error === "VIDEO_NOT_PUBLISHABLE") {
      // O salvamento já aconteceu: a UI informa que o vídeo segue rascunho.
      return Response.json({ video, published: false } satisfies VideoUpdateResult);
    }
  }
  return published;
}

// DELETE /api/videos/{publicId} → DELETE /videos/{publicId} (204 pass-through).
export async function DELETE(_request: Request, { params }: PublicIdContext) {
  const { publicId } = await params;
  return withSession((headers) =>
    upstream.DELETE("/videos/{publicId}", {
      params: { path: { publicId } },
      headers,
    })
  );
}
