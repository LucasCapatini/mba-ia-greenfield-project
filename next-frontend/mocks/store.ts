import type { Channel, Video } from "@/lib/api/contracts";

import {
  buildChannel,
  buildOwnerVideos,
  buildUnprocessedVideo,
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
};

type StudioState = {
  videos: Map<string, VideoEntry>;
  channel: Channel;
  /** Nicknames que o canal já usou — respondem 404 depois da troca. */
  retiredNicknames: Set<string>;
};

/** Leituras em `processing` antes de `ready` (`becomes-ready-02` e uploads concluídos). */
export const READS_UNTIL_READY = 2;

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
  return {
    videos,
    channel: buildChannel(),
    retiredNicknames: new Set<string>(),
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
