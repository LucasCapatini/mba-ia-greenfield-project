import { http, HttpResponse } from "msw";

import type { paths } from "@/lib/api/types.gen";
import { env } from "@/lib/env";

import { OTHER_CHANNELS } from "../factories/social";
import { TECH_MASTERY, buildTechMasteryCards } from "../factories/videos";
import { studioStore } from "../store";
import {
  apiError,
  decodeCursor,
  paginate,
  parseLimit,
  requireBearer,
} from "./_http";
import { channelView } from "./_social";

type SubscriptionStateOk =
  paths["/channels/{nickname}/subscription"]["put"]["responses"][200]["content"]["application/json"];
type SubscribedChannelsOk =
  paths["/me/subscriptions"]["get"]["responses"][200]["content"]["application/json"];
type SubscriptionFeedOk =
  paths["/me/subscriptions/videos"]["get"]["responses"][200]["content"]["application/json"];

type NicknameParams = { nickname: string };

// Inscrições do usuário do store (Fase 06). Seed: segue `tech_mastery` (1.2K inscritos, 24 vídeos
// públicos). Trigger: inscrever-se no canal do próprio store → 422 `CANNOT_SUBSCRIBE_OWN_CHANNEL`.

const channelNotFound = () =>
  apiError(404, "CHANNEL_NOT_FOUND", "Channel not found");
const invalidQuery = () =>
  apiError(400, "VALIDATION_ERROR", "Invalid query parameters");

/** `cursor`/`limit` da query (`null` quando inválidos → 400). */
function pageParams(request: Request): { offset: number; limit: number } | null {
  const query = new URL(request.url).searchParams;
  const limit = parseLimit(query.get("limit"));
  const offset = decodeCursor(query.get("cursor"));
  return limit === null || offset === null ? null : { offset, limit };
}

function writeSubscription(
  nickname: string,
  request: Request,
  subscribe: boolean,
): Response {
  const view = channelView(nickname, request);
  if (!view) {
    return channelNotFound();
  }
  if (view.own) {
    return subscribe
      ? apiError(
          422,
          "CANNOT_SUBSCRIBE_OWN_CHANNEL",
          "You cannot subscribe to your own channel",
        )
      : HttpResponse.json<SubscriptionStateOk>({
          subscribed: false,
          subscriber_count: view.channel.subscriber_count,
        });
  }
  const { subscriptions, subscriberCounts } = studioStore().social;
  let changed: boolean;
  if (subscribe) {
    changed = !subscriptions.has(nickname);
    subscriptions.add(nickname);
  } else {
    changed = subscriptions.delete(nickname);
  }
  const count =
    (subscriberCounts.get(nickname) ?? 0) + (changed ? (subscribe ? 1 : -1) : 0);
  subscriberCounts.set(nickname, count);
  return HttpResponse.json<SubscriptionStateOk>({
    subscribed: subscribe,
    subscriber_count: count,
  });
}

export const handlers = [
  // PUT /channels/:nickname/subscription — idempotente; próprio canal → 422
  http.put<NicknameParams>(
    `${env.API_URL}/channels/:nickname/subscription`,
    ({ params, request }) =>
      requireBearer(request) ??
      writeSubscription(params.nickname, request, true),
  ),

  // DELETE /channels/:nickname/subscription — idempotente
  http.delete<NicknameParams>(
    `${env.API_URL}/channels/:nickname/subscription`,
    ({ params, request }) =>
      requireBearer(request) ??
      writeSubscription(params.nickname, request, false),
  ),

  // GET /me/subscriptions — canais seguidos em ordem alfabética do nome
  http.get(`${env.API_URL}/me/subscriptions`, ({ request }) => {
    const unauthorized = requireBearer(request);
    if (unauthorized) {
      return unauthorized;
    }
    const params = pageParams(request);
    if (!params) {
      return invalidQuery();
    }
    const followed = [...studioStore().social.subscriptions]
      .map((nickname) => OTHER_CHANNELS.get(nickname))
      .filter((channel) => channel !== undefined)
      .map((channel) => ({ nickname: channel.nickname, name: channel.name }))
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name) || a.nickname.localeCompare(b.nickname),
      );
    return HttpResponse.json<SubscribedChannelsOk>(
      paginate(followed, params.offset, params.limit),
    );
  }),

  // GET /me/subscriptions/videos — feed dos canais seguidos, mais recentes primeiro
  http.get(`${env.API_URL}/me/subscriptions/videos`, ({ request }) => {
    const unauthorized = requireBearer(request);
    if (unauthorized) {
      return unauthorized;
    }
    const params = pageParams(request);
    if (!params) {
      return invalidQuery();
    }
    // Só `tech_mastery` tem vídeos públicos entre os canais de outros usuários dos fixtures.
    const cards = studioStore().social.subscriptions.has(TECH_MASTERY.nickname)
      ? buildTechMasteryCards()
      : [];
    cards.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
    return HttpResponse.json<SubscriptionFeedOk>(
      paginate(cards, params.offset, params.limit),
    );
  }),
];
