import { http, HttpResponse } from "msw";

import type { paths } from "@/lib/api/types.gen";
import { env } from "@/lib/env";

import {
  FIXTURE_NOW,
  TECH_MASTERY,
  buildTechMasteryCards,
  toChannelPublic,
  toVideoCardItem,
  toVideoListItem,
} from "../factories/videos";
import { studioStore } from "../store";
import {
  apiError,
  decodeCursor,
  paginate,
  parseLimit,
  requireBearer,
} from "./_http";
import { channelView } from "./_social";

type ChannelOk =
  paths["/channels/me"]["get"]["responses"][200]["content"]["application/json"];
type UpdateChannelBody =
  paths["/channels/me"]["patch"]["requestBody"]["content"]["application/json"];
type ChannelPublicOk =
  paths["/channels/{nickname}"]["get"]["responses"][200]["content"]["application/json"];
type OwnerVideosOk =
  paths["/channels/me/videos"]["get"]["responses"][200]["content"]["application/json"];
type OwnerVideosQuery = NonNullable<
  paths["/channels/me/videos"]["get"]["parameters"]["query"]
>;
type ChannelVideosOk =
  paths["/channels/{nickname}/videos"]["get"]["responses"][200]["content"]["application/json"];
type ChannelVideosQuery = NonNullable<
  paths["/channels/{nickname}/videos"]["get"]["parameters"]["query"]
>;
type VideoCardItem = ChannelVideosOk["items"][number];
type VideoListItem = OwnerVideosOk["items"][number];

type NicknameParams = { nickname: string };

// Reserved trigger table (shared with E2E — trigger values must not collide across test suites).
// `tech_mastery` é o canal público de leitura; qualquer outro nickname fora do store → 404.
const TAKEN_NICKNAME = "taken_nick";

const OWNER_SORTS: readonly NonNullable<OwnerVideosQuery["sort"]>[] = [
  "latest",
  "oldest",
  "views",
];
const CHANNEL_SORTS: readonly NonNullable<ChannelVideosQuery["sort"]>[] = [
  "latest",
  "popular",
  "oldest",
];

const channelNotFound = () =>
  apiError(404, "CHANNEL_NOT_FOUND", "Channel not found");
const invalidQuery = (message: string) =>
  apiError(400, "VALIDATION_ERROR", message);

function oneOf<T extends string>(
  allowed: readonly T[],
  raw: string | null,
): T | undefined | null {
  if (raw === null) {
    return undefined;
  }
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

const byDateDesc = (a: string | null, b: string | null) =>
  (b ?? "").localeCompare(a ?? "");

function sortOwnerVideos(
  items: VideoListItem[],
  sort: NonNullable<OwnerVideosQuery["sort"]>,
): VideoListItem[] {
  const sorted = [...items];
  if (sort === "views") {
    return sorted.sort(
      (a, b) =>
        b.view_count - a.view_count || byDateDesc(a.created_at, b.created_at),
    );
  }
  sorted.sort((a, b) => byDateDesc(a.created_at, b.created_at));
  return sort === "oldest" ? sorted.reverse() : sorted;
}

function sortChannelCards(
  items: VideoCardItem[],
  sort: NonNullable<ChannelVideosQuery["sort"]>,
): VideoCardItem[] {
  const sorted = [...items];
  if (sort === "popular") {
    return sorted.sort(
      (a, b) =>
        b.view_count - a.view_count ||
        byDateDesc(a.published_at, b.published_at),
    );
  }
  sorted.sort((a, b) => byDateDesc(a.published_at, b.published_at));
  return sort === "oldest" ? sorted.reverse() : sorted;
}

/** Cards públicos do canal: o `tech_mastery` fixo ou os publicados/públicos do store. */
function publicCardsOf(nickname: string): VideoCardItem[] | null {
  if (nickname === TECH_MASTERY.nickname) {
    return buildTechMasteryCards();
  }
  const { channel, videos } = studioStore();
  if (nickname !== channel.nickname) {
    return null;
  }
  return [...videos.values()]
    .filter(
      (entry) =>
        !entry.hidden &&
        entry.video.status === "published" &&
        entry.video.visibility === "public",
    )
    .map((entry) => toVideoCardItem(entry.video, channel));
}

export const handlers = [
  // GET /channels/me — registrado antes de `/channels/:nickname` (o MSW usa o primeiro que casar)
  http.get(`${env.API_URL}/channels/me`, ({ request }) => {
    const unauthorized = requireBearer(request);
    if (unauthorized) {
      return unauthorized;
    }
    return HttpResponse.json<ChannelOk>(studioStore().channel);
  }),

  // PATCH /channels/me — trigger `taken_nick` → 409; o nickname antigo deixa de resolver
  http.patch(`${env.API_URL}/channels/me`, async ({ request }) => {
    const unauthorized = requireBearer(request);
    if (unauthorized) {
      return unauthorized;
    }
    const body = (await request.json()) as UpdateChannelBody;
    if (body.nickname === TAKEN_NICKNAME) {
      return apiError(
        409,
        "NICKNAME_TAKEN",
        `Nickname "${TAKEN_NICKNAME}" is already taken`,
      );
    }
    const store = studioStore();
    const { channel } = store;
    if (body.nickname !== undefined && body.nickname !== channel.nickname) {
      store.retiredNicknames.add(channel.nickname);
    }
    store.channel = {
      ...channel,
      nickname: body.nickname ?? channel.nickname,
      name: body.name ?? channel.name,
      description:
        body.description === undefined ? channel.description : body.description,
      updated_at: FIXTURE_NOW,
    };
    return HttpResponse.json<ChannelOk>(store.channel);
  }),

  // GET /channels/me/videos — filtros, busca, ordenação e cursor sobre o store
  http.get(`${env.API_URL}/channels/me/videos`, ({ request }) => {
    const unauthorized = requireBearer(request);
    if (unauthorized) {
      return unauthorized;
    }
    const query = new URL(request.url).searchParams;
    const sort = oneOf(OWNER_SORTS, query.get("sort"));
    const status = oneOf(["draft", "published"] as const, query.get("status"));
    const visibility = oneOf(
      ["public", "unlisted"] as const,
      query.get("visibility"),
    );
    const processingStatus = oneOf(
      ["uploading", "processing", "ready", "failed"] as const,
      query.get("processing_status"),
    );
    const limit = parseLimit(query.get("limit"));
    const offset = decodeCursor(query.get("cursor"));
    if (
      sort === null ||
      status === null ||
      visibility === null ||
      processingStatus === null ||
      limit === null ||
      offset === null
    ) {
      return invalidQuery("Invalid query parameters");
    }
    const q = query.get("q")?.trim().toLowerCase() ?? "";
    const from = query.get("from");
    const to = query.get("to");

    const filtered = [...studioStore().videos.values()]
      .filter((entry) => !entry.hidden)
      .map((entry) => toVideoListItem(entry.video))
      .filter(
        (item) =>
          (status === undefined || item.status === status) &&
          (visibility === undefined || item.visibility === visibility) &&
          (processingStatus === undefined ||
            item.processing_status === processingStatus) &&
          (q === "" || item.title.toLowerCase().includes(q)) &&
          (from === null || item.created_at.slice(0, 10) >= from) &&
          (to === null || item.created_at.slice(0, 10) <= to),
      );
    const sorted = sortOwnerVideos(filtered, sort ?? "latest");
    return HttpResponse.json<OwnerVideosOk>({
      ...paginate(sorted, offset, limit),
      total: sorted.length,
    });
  }),

  // GET /channels/:nickname — canal do store, `tech_mastery` ou 404; inscritos e
  // `viewer_subscribed` vêm do store social (Fase 06)
  http.get<NicknameParams>(
    `${env.API_URL}/channels/:nickname`,
    ({ params, request }) => {
      const { channel } = studioStore();
      const isStoreChannel = params.nickname === channel.nickname;
      if (!isStoreChannel && params.nickname !== TECH_MASTERY.nickname) {
        return channelNotFound();
      }
      const view = channelView(params.nickname, request);
      if (!view) {
        return channelNotFound();
      }
      const social = {
        subscriber_count: view.channel.subscriber_count,
        viewer_subscribed: view.channel.viewer_subscribed,
      };
      return HttpResponse.json<ChannelPublicOk>(
        isStoreChannel
          ? toChannelPublic(channel, social)
          : { ...TECH_MASTERY, ...social },
      );
    },
  ),

  // GET /channels/:nickname/videos — só publicados e públicos
  http.get<NicknameParams>(
    `${env.API_URL}/channels/:nickname/videos`,
    ({ params, request }) => {
      const cards = publicCardsOf(params.nickname);
      if (cards === null) {
        return channelNotFound();
      }
      const query = new URL(request.url).searchParams;
      const sort = oneOf(CHANNEL_SORTS, query.get("sort"));
      const limit = parseLimit(query.get("limit"));
      const offset = decodeCursor(query.get("cursor"));
      if (sort === null || limit === null || offset === null) {
        return invalidQuery("Invalid query parameters");
      }
      return HttpResponse.json<ChannelVideosOk>(
        paginate(sortChannelCards(cards, sort ?? "latest"), offset, limit),
      );
    },
  ),
];
