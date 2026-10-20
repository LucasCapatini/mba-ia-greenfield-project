import type { paths } from "@/lib/api/types.gen";

import { OTHER_CHANNELS, type StoredComment } from "../factories/social";
import { studioStore } from "../store";
import { apiError } from "./_http";

type VideoChannel =
  paths["/videos/{publicId}"]["get"]["responses"][200]["content"]["application/json"]["channel"];
type CommentOk =
  paths["/videos/{publicId}/comments"]["post"]["responses"][201]["content"]["application/json"];
type ReactionValue = "like" | "dislike";

/**
 * Regras sociais compartilhadas pelos handlers (Fase 06). Qualquer `Bearer` é o usuário do store
 * (canal `studio_canal`); anônimo não tem reação, inscrição nem autoria.
 */
export function isSignedIn(request: Request): boolean {
  return (request.headers.get("authorization") ?? "").startsWith("Bearer ");
}

/** Canal público com inscritos e estado do espectador; `null` se o nickname é desconhecido. */
export function channelView(
  nickname: string,
  request: Request,
): { channel: VideoChannel; own: boolean } | null {
  const { channel, social } = studioStore();
  if (nickname === channel.nickname) {
    return {
      channel: {
        nickname: channel.nickname,
        name: channel.name,
        subscriber_count: social.ownSubscribers,
        viewer_subscribed: false,
      },
      own: true,
    };
  }
  const other = OTHER_CHANNELS.get(nickname);
  if (!other) {
    return null;
  }
  return {
    channel: {
      nickname: other.nickname,
      name: other.name,
      subscriber_count: social.subscriberCounts.get(nickname) ?? 0,
      viewer_subscribed:
        isSignedIn(request) && social.subscriptions.has(nickname),
    },
    own: false,
  };
}

/** Canal do autor (`"self"` = canal atual do store). */
export function authorOf(comment: StoredComment): { nickname: string; name: string } {
  if (comment.author === "self") {
    const { channel } = studioStore();
    return { nickname: channel.nickname, name: channel.name };
  }
  const other = OTHER_CHANNELS.get(comment.author);
  return {
    nickname: comment.author,
    name: other?.name ?? comment.author,
  };
}

/** `CommentResponse` com o estado do espectador desta requisição. */
export function presentComment(
  comment: StoredComment,
  request: Request,
): CommentOk {
  const signedIn = isSignedIn(request);
  return {
    id: comment.id,
    parent_id: comment.parent_id,
    text: comment.text,
    author: authorOf(comment),
    created_at: comment.created_at,
    edited_at: comment.edited_at,
    like_count: comment.like_count,
    dislike_count: comment.dislike_count,
    reply_count: comment.reply_count,
    viewer_reaction: signedIn
      ? (studioStore().social.commentReactions.get(comment.id) ?? null)
      : null,
    viewer_is_author: signedIn && comment.author === "self",
  };
}

/** Delta dos contadores na transição de reação (mesma regra do backend — TD-02). */
export function reactionDelta(
  previous: ReactionValue | null,
  next: ReactionValue | null,
): { like: number; dislike: number } {
  const score = (value: ReactionValue | null, target: ReactionValue) =>
    value === target ? 1 : 0;
  return {
    like: score(next, "like") - score(previous, "like"),
    dislike: score(next, "dislike") - score(previous, "dislike"),
  };
}

/** Lê `{ value }` do corpo de `PUT …/reaction`; inválido → `null` (400 no handler). */
export async function readReactionValue(
  request: Request,
): Promise<ReactionValue | null> {
  const body = (await request.json().catch(() => null)) as {
    value?: unknown;
  } | null;
  return body?.value === "like" || body?.value === "dislike"
    ? body.value
    : null;
}

export const invalidReaction = () =>
  apiError(400, "VALIDATION_ERROR", "value must be one of: like, dislike");
