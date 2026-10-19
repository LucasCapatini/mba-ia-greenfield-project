import type {
  Category,
  Channel,
  ChannelPublic,
  Video,
  VideoCardItem,
  VideoListItem,
} from "@/lib/api/contracts";

// Origem pública do storage em dev (`S3_PUBLIC_ENDPOINT`) — o navegador carrega as thumbnails
// direto dela; os E2E atendem essas URLs com `page.route('http://localhost:9000/**')`.
export const STORAGE_PUBLIC_ORIGIN = "http://localhost:9000";
export const STORAGE_BUCKET = "streamtube-videos";

// Relógio fixo dos fixtures — nada depende de `Date.now()`, então as respostas são determinísticas.
export const FIXTURE_NOW = "2026-10-01T12:00:00.000Z";

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO `days` dias antes de `FIXTURE_NOW`. */
export function daysAgo(days: number): string {
  return new Date(Date.parse(FIXTURE_NOW) - days * DAY_MS).toISOString();
}

/** URL pública estável da thumbnail (video-channel-management/TD-03): `?v=` muda a cada troca. */
export function thumbnailUrl(
  publicId: string,
  version: number,
  kind: "auto" | "custom" = "auto",
): string {
  return `${STORAGE_PUBLIC_ORIGIN}/${STORAGE_BUCKET}/thumbnails/${publicId}/${kind}.jpg?v=${version}`;
}

// ─── Categories ───────────────────────────────────────────────────────────────

// Espelha a migration `SeedCategories` (slug, nome, ordem).
const CATEGORY_SEED: ReadonlyArray<readonly [slug: string, name: string]> = [
  ["music", "Music"],
  ["gaming", "Gaming"],
  ["education", "Education"],
  ["entertainment", "Entertainment"],
  ["sports", "Sports"],
  ["news", "News"],
  ["technology", "Technology"],
  ["travel", "Travel"],
  ["cooking", "Cooking"],
  ["other", "Other"],
];

export const CATEGORIES: readonly Category[] = CATEGORY_SEED.map(
  ([slug, name], index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    slug,
    name,
    sort_order: index + 1,
  }),
);

export function findCategory(slug: string): Category {
  const category = CATEGORIES.find((item) => item.slug === slug);
  if (!category) {
    throw new Error(`Unknown fixture category: ${slug}`);
  }
  return category;
}

// ─── Videos ───────────────────────────────────────────────────────────────────

const baseVideo: Video = {
  public_id: "video-fixture",
  status: "draft",
  visibility: "public",
  processing_status: "ready",
  processing_error: null,
  title: "Vídeo de teste",
  description: null,
  category: null,
  original_filename: "video.mp4",
  content_type: "video/mp4",
  size_bytes: 10_485_760,
  duration_seconds: 125,
  width: 1920,
  height: 1080,
  container: "mp4",
  video_codec: "h264",
  audio_codec: "aac",
  thumbnail_url: null,
  has_custom_thumbnail: false,
  view_count: 0,
  like_count: 0,
  dislike_count: 0,
  comment_count: 0,
  published_at: null,
  created_at: FIXTURE_NOW,
  processed_at: FIXTURE_NOW,
};

/** Vídeo `ready` com thumbnail automática `?v=1` (sobrescreva o que o cenário precisa). */
export const buildVideo = (overrides: Partial<Video> = {}): Video => {
  const publicId = overrides.public_id ?? baseVideo.public_id;
  return {
    ...baseVideo,
    thumbnail_url: thumbnailUrl(publicId, 1),
    ...overrides,
  };
};

/** Vídeo ainda sem bytes processados (upload ou processamento em andamento). */
export const buildUnprocessedVideo = (
  processingStatus: "uploading" | "processing",
  overrides: Partial<Video> = {},
): Video =>
  buildVideo({
    processing_status: processingStatus,
    duration_seconds: null,
    width: null,
    height: null,
    container: null,
    video_codec: null,
    audio_codec: null,
    thumbnail_url: null,
    processed_at: null,
    ...overrides,
  });

/** Projeção de `Video` na linha do painel (`VideoListItem`), como o backend faz. */
export function toVideoListItem(video: Video): VideoListItem {
  return {
    public_id: video.public_id,
    title: video.title,
    status: video.status,
    visibility: video.visibility,
    processing_status: video.processing_status,
    processing_error: video.processing_error,
    thumbnail_url: video.thumbnail_url,
    duration_seconds: video.duration_seconds,
    view_count: video.view_count,
    like_count: video.like_count,
    comment_count: video.comment_count,
    published_at: video.published_at,
    created_at: video.created_at,
  };
}

/** Projeção pública de `Video` (`VideoCardItem`) para o canal `channel`. */
export function toVideoCardItem(
  video: Video,
  channel: Pick<ChannelPublic, "nickname" | "name">,
): VideoCardItem {
  return {
    public_id: video.public_id,
    title: video.title,
    thumbnail_url: video.thumbnail_url,
    duration_seconds: video.duration_seconds,
    view_count: video.view_count,
    published_at: video.published_at,
    channel: { nickname: channel.nickname, name: channel.name },
  };
}

/**
 * Os 22 vídeos do canal do usuário logado nos E2E do Studio (specs `studio-videos`,
 * `studio-video-edit`, `studio-upload-processing`). Ordem de `created_at`: o índice 0 é o mais novo.
 */
export function buildOwnerVideos(): Video[] {
  const named: Video[] = [
    buildVideo({
      public_id: "ready-draft-01",
      title: "Aula pronta",
      description: "Primeira aula do curso",
      category: findCategory("music"),
      original_filename: "aula-pronta.mp4",
    }),
    buildVideo({
      public_id: "published-01",
      title: "Aula publicada",
      status: "published",
      visibility: "public",
      view_count: 1_520,
      like_count: 87,
      comment_count: 12,
      published_at: daysAgo(1),
    }),
    buildUnprocessedVideo("processing", {
      public_id: "becomes-ready-02",
      title: "Aula processando",
    }),
    buildVideo({
      public_id: "failed-01",
      title: "Arquivo inválido",
      processing_status: "failed",
      processing_error: "UNSUPPORTED_FORMAT",
      original_filename: "arquivo-invalido.avi",
      duration_seconds: null,
      width: null,
      height: null,
      container: null,
      video_codec: null,
      audio_codec: null,
      thumbnail_url: null,
    }),
    buildVideo({ public_id: "draft-aula-02", title: "Aula 2" }),
    buildVideo({ public_id: "draft-aula-03", title: "aula 3" }),
    buildUnprocessedVideo("processing", {
      public_id: "processing-01",
      title: "Vídeo em processamento",
    }),
  ];
  const published = Array.from({ length: 15 }, (_, index) => {
    const n = String(index + 1).padStart(2, "0");
    return buildVideo({
      public_id: `published-v${n}`,
      title: `Video ${n}`,
      status: "published",
      view_count: (index + 1) * 100,
      published_at: daysAgo(named.length + index),
    });
  });
  return [...named, ...published].map((video, index) => ({
    ...video,
    created_at: daysAgo(index),
  }));
}

// ─── Channels ─────────────────────────────────────────────────────────────────

const baseChannel: Channel = {
  id: "11111111-1111-4111-8111-111111111111",
  nickname: "studio_canal",
  name: "Studio Canal",
  description: "Canal de testes",
  video_count: 3,
  created_at: "2026-01-15T10:00:00.000Z",
  updated_at: "2026-01-15T10:00:00.000Z",
};

export const buildChannel = (overrides: Partial<Channel> = {}): Channel => ({
  ...baseChannel,
  ...overrides,
});

export function toChannelPublic(channel: Channel): ChannelPublic {
  return {
    nickname: channel.nickname,
    name: channel.name,
    description: channel.description,
    video_count: channel.video_count,
    created_at: channel.created_at,
  };
}

/** Canal público de leitura dos E2E (`channel-public`). */
export const TECH_MASTERY: ChannelPublic = {
  nickname: "tech_mastery",
  name: "Tech Mastery",
  description: "Tutoriais de tecnologia",
  video_count: 24,
  created_at: "2025-03-10T09:00:00.000Z",
};

/** 24 vídeos publicados do `tech_mastery`, com `view_count` distintos (ordem de publicação). */
export function buildTechMasteryCards(): VideoCardItem[] {
  return Array.from({ length: 24 }, (_, index) => {
    const n = String(index + 1).padStart(2, "0");
    const publicId = `tech-video-${n}`;
    return toVideoCardItem(
      buildVideo({
        public_id: publicId,
        title: `Tutorial ${n}`,
        status: "published",
        duration_seconds: 300 + index * 15,
        // Distintos e fora da ordem de publicação, para `sort=popular` reordenar de fato.
        view_count: ((index * 7) % 24) * 1_000 + 500,
        published_at: daysAgo(index),
      }),
      TECH_MASTERY,
    );
  });
}
