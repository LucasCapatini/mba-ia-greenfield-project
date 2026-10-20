import { http, HttpResponse } from "msw";

import type { paths } from "@/lib/api/types.gen";
import { env } from "@/lib/env";

import {
  COMMENTS_DOWN_ID,
  buildComment,
  type StoredComment,
} from "../factories/social";
import { studioStore, type VideoEntry } from "../store";
import {
  apiError,
  decodeCursor,
  paginate,
  parseLimit,
  requireBearer,
} from "./_http";
import {
  invalidReaction,
  presentComment,
  reactionDelta,
  readReactionValue,
} from "./_social";

type CommentsPageOk =
  paths["/videos/{publicId}/comments"]["get"]["responses"][200]["content"]["application/json"];
type CommentOk =
  paths["/videos/{publicId}/comments"]["post"]["responses"][201]["content"]["application/json"];
type CreateCommentBody =
  paths["/videos/{publicId}/comments"]["post"]["requestBody"]["content"]["application/json"];
type ReactionStateOk =
  paths["/comments/{commentId}/reaction"]["put"]["responses"][200]["content"]["application/json"];

type VideoParams = { publicId: string };
type CommentParams = { commentId: string };

// Reserved trigger table (shared with E2E — trigger values must not collide across test suites).
// `comments-down-id` (vídeo publicado de `tech_mastery`) → `GET …/comments` responde 500.
const COMMENT_SORTS = ["latest", "top"] as const;
const COMMENT_MAX_LENGTH = 2_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const videoNotFound = () => apiError(404, "VIDEO_NOT_FOUND", "Video not found");
const commentNotFound = () =>
  apiError(404, "COMMENT_NOT_FOUND", "Comment not found");
const commentForbidden = () =>
  apiError(
    403,
    "COMMENT_FORBIDDEN",
    "Only the author can change this comment",
  );
const invalidQuery = () =>
  apiError(400, "VALIDATION_ERROR", "Invalid query parameters");

/** Comentários e reações só em vídeo `published`, inclusive para o dono (TD-03, Revisions). */
function publishedVideo(publicId: string): VideoEntry | null {
  const entry = studioStore().videos.get(publicId);
  return entry?.video.status === "published" ? entry : null;
}

/** Comentário visível: id uuid, existente e de vídeo publicado (senão 404). */
function visibleComment(
  commentId: string,
): { comment: StoredComment; video: VideoEntry } | null {
  if (!UUID_PATTERN.test(commentId)) {
    return null;
  }
  const comment = studioStore().social.comments.get(commentId);
  const video = comment ? publishedVideo(comment.video_id) : null;
  return comment && video ? { comment, video } : null;
}

/** Texto após `trim`, 1 a 2.000 caracteres (TD-07); inválido → `null`. */
async function readText(request: Request): Promise<string | null> {
  const body = (await request
    .json()
    .catch(() => null)) as Partial<CreateCommentBody> | null;
  if (typeof body?.text !== "string") {
    return null;
  }
  const text = body.text.trim();
  return text.length >= 1 && text.length <= COMMENT_MAX_LENGTH ? text : null;
}

const invalidText = () =>
  apiError(
    400,
    "VALIDATION_ERROR",
    "text must be between 1 and 2000 characters",
  );

const newest = (a: StoredComment, b: StoredComment) =>
  b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);
const oldest = (a: StoredComment, b: StoredComment) => newest(b, a);
const mostLiked = (a: StoredComment, b: StoredComment) =>
  b.like_count - a.like_count || newest(a, b);

function bumpCommentCount(video: VideoEntry, delta: number): void {
  video.video = {
    ...video.video,
    comment_count: video.video.comment_count + delta,
  };
}

function page(
  items: StoredComment[],
  request: Request,
): Response {
  const query = new URL(request.url).searchParams;
  const limit = parseLimit(query.get("limit"));
  const offset = decodeCursor(query.get("cursor"));
  if (limit === null || offset === null) {
    return invalidQuery();
  }
  const slice = paginate(items, offset, limit);
  return HttpResponse.json<CommentsPageOk>({
    items: slice.items.map((comment) => presentComment(comment, request)),
    next_cursor: slice.next_cursor,
  });
}

function created(comment: StoredComment, request: Request): Response {
  studioStore().social.comments.set(comment.id, comment);
  return HttpResponse.json<CommentOk>(presentComment(comment, request), {
    status: 201,
  });
}

function writeCommentReaction(
  commentId: string,
  next: "like" | "dislike" | null,
): Response {
  const found = visibleComment(commentId);
  if (!found) {
    return commentNotFound();
  }
  const { comments, commentReactions } = studioStore().social;
  const delta = reactionDelta(commentReactions.get(commentId) ?? null, next);
  if (next === null) {
    commentReactions.delete(commentId);
  } else {
    commentReactions.set(commentId, next);
  }
  const updated = {
    ...found.comment,
    like_count: found.comment.like_count + delta.like,
    dislike_count: found.comment.dislike_count + delta.dislike,
  };
  comments.set(commentId, updated);
  return HttpResponse.json<ReactionStateOk>({
    viewer_reaction: next,
    like_count: updated.like_count,
    dislike_count: updated.dislike_count,
  });
}

export const handlers = [
  // GET /videos/:publicId/comments — raízes por `latest` (padrão) ou `top`, cursor por deslocamento
  http.get<VideoParams>(
    `${env.API_URL}/videos/:publicId/comments`,
    ({ params, request }) => {
      if (params.publicId === COMMENTS_DOWN_ID) {
        return apiError(500, "INTERNAL_SERVER_ERROR", "Internal server error");
      }
      if (!publishedVideo(params.publicId)) {
        return videoNotFound();
      }
      const raw = new URL(request.url).searchParams.get("sort") ?? "latest";
      if (!(COMMENT_SORTS as readonly string[]).includes(raw)) {
        return invalidQuery();
      }
      const roots = [...studioStore().social.comments.values()]
        .filter(
          (comment) =>
            comment.video_id === params.publicId && comment.parent_id === null,
        )
        .sort(raw === "top" ? mostLiked : newest);
      return page(roots, request);
    },
  ),

  // POST /videos/:publicId/comments — raiz do usuário do store; `comment_count + 1`
  http.post<VideoParams>(
    `${env.API_URL}/videos/:publicId/comments`,
    async ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const video = publishedVideo(params.publicId);
      if (!video) {
        return videoNotFound();
      }
      const text = await readText(request);
      if (text === null) {
        return invalidText();
      }
      bumpCommentCount(video, 1);
      return created(
        buildComment(params.publicId, "self", {
          text,
          created_at: new Date().toISOString(),
        }),
        request,
      );
    },
  ),

  // PATCH /comments/:commentId — só o autor (403); grava `edited_at`
  http.patch<CommentParams>(
    `${env.API_URL}/comments/:commentId`,
    async ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const found = visibleComment(params.commentId);
      if (!found) {
        return commentNotFound();
      }
      if (found.comment.author !== "self") {
        return commentForbidden();
      }
      const text = await readText(request);
      if (text === null) {
        return invalidText();
      }
      const updated = {
        ...found.comment,
        text,
        edited_at: new Date().toISOString(),
      };
      studioStore().social.comments.set(updated.id, updated);
      return HttpResponse.json<CommentOk>(presentComment(updated, request));
    },
  ),

  // DELETE /comments/:commentId — raiz leva as respostas (`1 + reply_count`); resposta tira 1
  http.delete<CommentParams>(
    `${env.API_URL}/comments/:commentId`,
    ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const found = visibleComment(params.commentId);
      if (!found) {
        return commentNotFound();
      }
      const { comment, video } = found;
      if (comment.author !== "self") {
        return commentForbidden();
      }
      const { comments, commentReactions } = studioStore().social;
      if (comment.parent_id === null) {
        for (const [id, item] of comments) {
          if (item.parent_id === comment.id) {
            comments.delete(id);
            commentReactions.delete(id);
          }
        }
        bumpCommentCount(video, -(1 + comment.reply_count));
      } else {
        const root = comments.get(comment.parent_id);
        if (root) {
          comments.set(root.id, { ...root, reply_count: root.reply_count - 1 });
        }
        bumpCommentCount(video, -1);
      }
      comments.delete(comment.id);
      commentReactions.delete(comment.id);
      return new HttpResponse(null, { status: 204 });
    },
  ),

  // GET /comments/:commentId/replies — só de raiz, da mais antiga para a mais nova
  http.get<CommentParams>(
    `${env.API_URL}/comments/:commentId/replies`,
    ({ params, request }) => {
      const found = visibleComment(params.commentId);
      if (!found || found.comment.parent_id !== null) {
        return commentNotFound();
      }
      const replies = [...studioStore().social.comments.values()]
        .filter((comment) => comment.parent_id === found.comment.id)
        .sort(oldest);
      return page(replies, request);
    },
  ),

  // POST /comments/:commentId/replies — responder a uma resposta grava na raiz (um nível)
  http.post<CommentParams>(
    `${env.API_URL}/comments/:commentId/replies`,
    async ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const found = visibleComment(params.commentId);
      if (!found) {
        return commentNotFound();
      }
      const text = await readText(request);
      if (text === null) {
        return invalidText();
      }
      const { comments } = studioStore().social;
      const rootId = found.comment.parent_id ?? found.comment.id;
      const root = comments.get(rootId);
      if (root) {
        comments.set(rootId, { ...root, reply_count: root.reply_count + 1 });
      }
      bumpCommentCount(found.video, 1);
      return created(
        buildComment(found.comment.video_id, "self", {
          parent_id: rootId,
          text,
          created_at: new Date().toISOString(),
        }),
        request,
      );
    },
  ),

  // PUT /comments/:commentId/reaction — mesma semântica da reação ao vídeo
  http.put<CommentParams>(
    `${env.API_URL}/comments/:commentId/reaction`,
    async ({ params, request }) => {
      const unauthorized = requireBearer(request);
      if (unauthorized) {
        return unauthorized;
      }
      const value = await readReactionValue(request);
      if (value === null) {
        return invalidReaction();
      }
      return writeCommentReaction(params.commentId, value);
    },
  ),

  // DELETE /comments/:commentId/reaction
  http.delete<CommentParams>(
    `${env.API_URL}/comments/:commentId/reaction`,
    ({ params, request }) => {
      const unauthorized = requireBearer(request);
      return unauthorized ?? writeCommentReaction(params.commentId, null);
    },
  ),
];
