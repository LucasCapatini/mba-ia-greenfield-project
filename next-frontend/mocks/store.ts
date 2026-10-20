import type { Channel, ReactionValue, Video } from "@/lib/api/contracts";

import {
  COMMENTS_DOWN_ID,
  OTHER_CHANNELS,
  TECH_VIDEO_ID,
  buildSeedComments,
  resetCommentIds,
  type StoredComment,
} from "./factories/social";
import {
  TECH_MASTERY,
  buildChannel,
  buildOwnerVideos,
  buildUnprocessedVideo,
  buildVideo,
  daysAgo,
  findCategory,
} from "./factories/videos";

/**
 * Estado mutável dos fixtures do Studio (vídeos + canal do usuário logado).
 *
 * Compartilhado pelos handlers de `videos.ts` e `channels.ts` para que mutações (PATCH, publish,
 * DELETE, troca de nickname) apareçam nas leituras seguintes, como no backend real. É resetado
 * pelo handler de `POST /auth/login` (cada E2E começa logando) e depois de cada teste do Vitest
 * (`mocks/setup.ts`).
 */
export type UploadEntry = {
  upload_id: string;
  part_size: number;
  part_count: number;
  expected_bytes: number;
  state: "active" | "completed" | "aborted" | "expired";
};

export type VideoEntry = {
  video: Video;
  /** Fora da listagem do painel (trigger fixtures como `processing-id`). */
  hidden: boolean;
  /** Leituras de `GET /videos/{id}` que ainda respondem `processing` antes de virar `ready`. */
  readsUntilReady: number | null;
  thumbnailVersion: number;
  upload: UploadEntry | null;
  /** Nickname do canal dono quando não é o do usuário logado (vídeos de `tech_mastery`). */
  owner?: string;
};

/**
 * Interações sociais do usuário logado (Fase 06). Qualquer `Bearer` é esse usuário; anônimo
 * não tem reações nem inscrições. Contadores de outros canais e comentários vivem aqui para que
 * as mutações apareçam nas leituras seguintes, como no backend.
 */
export type SocialState = {
  /** Comentários e respostas por id. */
  comments: Map<string, StoredComment>;
  /** Reação do usuário logado por `public_id` de vídeo. */
  videoReactions: Map<string, ReactionValue>;
  /** Reação do usuário logado por id de comentário. */
  commentReactions: Map<string, ReactionValue>;
  /** Nicknames dos canais que o usuário logado segue. */
  subscriptions: Set<string>;
  /** Inscritos dos outros canais (`OTHER_CHANNELS`) por nickname. */
  subscriberCounts: Map<string, number>;
  /** Inscritos do canal do próprio usuário (o nickname pode mudar). */
  ownSubscribers: number;
};

type StudioState = {
  videos: Map<string, VideoEntry>;
  channel: Channel;
  /** Nicknames que o canal já usou — respondem 404 depois da troca. */
  retiredNicknames: Set<string>;
  /** `publicId|espectador` já contados por `POST /videos/{id}/views` (dedup do backend). */
  countedViews: Set<string>;
  social: SocialState;
};

/** Leituras em `processing` antes de `ready` (`becomes-ready-02` e uploads concluídos). */
export const READS_UNTIL_READY = 2;

// Fixtures da watch page (spec `watch`), fora da listagem do painel e da página do canal.
/** Publicado e `unlisted`: abre por link, nunca aparece nas sugestões. */
export const UNLISTED_ID = "unlisted-01";
/** Publicado cujo `GET /videos/{id}/playback` responde 503 `STORAGE_UNAVAILABLE`. */
export const STORAGE_DOWN_ID = "storage-down-id";

function entry(video: Video, extra: Partial<VideoEntry> = {}): VideoEntry {
  return {
    video,
    hidden: false,
    readsUntilReady: null,
    thumbnailVersion: 1,
    upload: null,
    ...extra,
  };
}

function initialState(): StudioState {
  const videos = new Map<string, VideoEntry>();
  for (const video of buildOwnerVideos()) {
    videos.set(
      video.public_id,
      entry(video, {
        readsUntilReady:
          video.public_id === "becomes-ready-02" ? READS_UNTIL_READY : null,
      }),
    );
  }
  videos.set(
    "processing-id",
    entry(
      buildUnprocessedVideo("processing", {
        public_id: "processing-id",
        title: "Processamento contínuo",
      }),
      { hidden: true },
    ),
  );
  videos.set(
    UNLISTED_ID,
    entry(
      buildVideo({
        public_id: UNLISTED_ID,
        title: "Aula não listada",
        status: "published",
        visibility: "unlisted",
        category: findCategory("music"),
        published_at: daysAgo(0),
      }),
      { hidden: true },
    ),
  );
  videos.set(
    STORAGE_DOWN_ID,
    entry(
      buildVideo({
        public_id: STORAGE_DOWN_ID,
        title: "Storage fora do ar",
        status: "published",
        published_at: daysAgo(0),
      }),
      { hidden: true },
    ),
  );
  // Vídeos de `tech_mastery` assistíveis (spec `watch-social`), fora do painel do estúdio.
  videos.set(
    TECH_VIDEO_ID,
    entry(
      buildVideo({
        public_id: TECH_VIDEO_ID,
        title: "Keyset pagination na prática",
        status: "published",
        category: findCategory("education"),
        view_count: 48_300,
        like_count: 1_200,
        dislike_count: 14,
        comment_count: 25,
        published_at: daysAgo(2),
      }),
      { hidden: true, owner: TECH_MASTERY.nickname },
    ),
  );
  videos.set(
    COMMENTS_DOWN_ID,
    entry(
      buildVideo({
        public_id: COMMENTS_DOWN_ID,
        title: "Comentários fora do ar",
        status: "published",
        published_at: daysAgo(3),
      }),
      { hidden: true, owner: TECH_MASTERY.nickname },
    ),
  );
  resetCommentIds();
  return {
    videos,
    channel: buildChannel(),
    retiredNicknames: new Set<string>(),
    countedViews: new Set<string>(),
    social: {
      comments: new Map(
        buildSeedComments().map((comment) => [comment.id, comment]),
      ),
      videoReactions: new Map(),
      commentReactions: new Map(),
      subscriptions: new Set([TECH_MASTERY.nickname]),
      subscriberCounts: new Map(
        [...OTHER_CHANNELS.values()].map((channel) => [
          channel.nickname,
          channel.subscriber_count,
        ]),
      ),
      ownSubscribers: 3,
    },
  };
}

let state = initialState();

export function resetStudioStore(): void {
  state = initialState();
}

export function studioStore(): StudioState {
  return state;
}

export function createVideoEntry(
  video: Video,
  upload: UploadEntry,
): VideoEntry {
  const created = entry(video, { upload });
  state.videos.set(video.public_id, created);
  return created;
}
