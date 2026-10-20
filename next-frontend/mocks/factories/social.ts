import type { ChannelPublic, Comment } from "@/lib/api/contracts";

import { FIXTURE_NOW, TECH_MASTERY } from "./videos";

/**
 * Fixtures das interações sociais (Fase 06): canais de outros usuários (autores de comentários e
 * canais seguidos) e o seed de comentários dos vídeos públicos.
 *
 * O autor `"self"` é o usuário logado (canal do store, cujo nickname pode mudar): o handler
 * resolve o canal atual a cada resposta.
 */
export type CommentAuthor = "self" | string;

/** Comentário guardado no store, sem o estado do espectador (calculado por requisição). */
export type StoredComment = Omit<
  Comment,
  "author" | "viewer_reaction" | "viewer_is_author"
> & {
  video_id: string;
  author: CommentAuthor;
};

/** Canais de outros usuários conhecidos pelos fixtures (nickname → canal público). */
export const OTHER_CHANNELS: ReadonlyMap<string, ChannelPublic> = new Map(
  [
    TECH_MASTERY,
    {
      nickname: "bia",
      name: "Bia Souza",
      description: null,
      video_count: 0,
      created_at: "2025-06-01T09:00:00.000Z",
      subscriber_count: 18,
      viewer_subscribed: false,
    },
    ...["ana", "caio", "davi", "eva"].map((nickname, index) => ({
      nickname,
      name: nickname[0].toUpperCase() + nickname.slice(1),
      description: null,
      video_count: 0,
      created_at: "2025-07-01T09:00:00.000Z",
      subscriber_count: index,
      viewer_subscribed: false,
    })),
  ].map((channel) => [channel.nickname, channel]),
);

/** Instante `minutes` antes de `FIXTURE_NOW` (comentários com ordem cronológica estável). */
function minutesAgo(minutes: number): string {
  return new Date(Date.parse(FIXTURE_NOW) - minutes * 60_000).toISOString();
}

let commentSeq = 0;

/** Id determinístico em forma de uuid (o backend valida uuid no path). */
export function nextCommentId(): string {
  commentSeq += 1;
  const n = commentSeq.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${n}`;
}

export function resetCommentIds(): void {
  commentSeq = 0;
}

export function buildComment(
  videoId: string,
  author: CommentAuthor,
  overrides: Partial<StoredComment> = {},
): StoredComment {
  return {
    id: nextCommentId(),
    video_id: videoId,
    parent_id: null,
    text: "Comentário",
    author,
    created_at: FIXTURE_NOW,
    edited_at: null,
    like_count: 0,
    dislike_count: 0,
    reply_count: 0,
    ...overrides,
  };
}

/** Raiz com respostas: devolve a raiz (com `reply_count`) seguida das respostas. */
function thread(
  videoId: string,
  root: StoredComment,
  replies: { author: CommentAuthor; text: string }[],
): StoredComment[] {
  const answered = { ...root, reply_count: replies.length };
  const base = Date.parse(root.created_at);
  return [
    answered,
    ...replies.map((reply, index) =>
      buildComment(videoId, reply.author, {
        parent_id: root.id,
        text: reply.text,
        created_at: new Date(base + (index + 1) * 60_000).toISOString(),
      }),
    ),
  ];
}

const FILLER_AUTHORS = ["ana", "caio", "davi", "eva"];

/**
 * `tech-01` (spec `watch-social`): 23 raízes — a do próprio usuário (mais recente, com "⋮"), a de
 * `bia` com 2 respostas e o maior `like_count`, outra de `bia` sem respostas e 20 de preenchimento
 * — para "Show more comments" (20 + 3) e "Sort by: Top". `comment_count` = 25.
 */
function techCommentsSeed(videoId: string): StoredComment[] {
  const own = buildComment(videoId, "self", {
    text: "Alguém mais testou com Docker?",
    created_at: minutesAgo(5),
    like_count: 2,
  });
  const biaThread = thread(
    videoId,
    buildComment(videoId, "bia", {
      text: "Melhor explicação de keyset pagination que já vi.",
      created_at: minutesAgo(30),
      like_count: 340,
    }),
    [
      { author: "ana", text: "Concordo, ficou muito claro." },
      { author: "bia", text: "Obrigada!" },
    ],
  );
  const biaSolo = buildComment(videoId, "bia", {
    text: "Faltou falar de índices parciais.",
    created_at: minutesAgo(40),
    like_count: 12,
  });
  const fillers = Array.from({ length: 20 }, (_, index) =>
    buildComment(videoId, FILLER_AUTHORS[index % FILLER_AUTHORS.length], {
      text: `Comentário ${index + 1}`,
      created_at: minutesAgo(60 + index * 10),
      like_count: (index * 7) % 30,
    }),
  );
  return [own, ...biaThread, biaSolo, ...fillers];
}

/** `published-01` (vídeo do próprio usuário): 10 raízes + 2 respostas = `comment_count` 12. */
function publishedCommentsSeed(videoId: string): StoredComment[] {
  const biaThread = thread(
    videoId,
    buildComment(videoId, "bia", {
      text: "Aula excelente!",
      created_at: minutesAgo(15),
      like_count: 9,
    }),
    [
      { author: "self", text: "@bia valeu!" },
      { author: "caio", text: "Também gostei." },
    ],
  );
  const others = Array.from({ length: 9 }, (_, index) =>
    buildComment(videoId, FILLER_AUTHORS[index % FILLER_AUTHORS.length], {
      text: `Pergunta ${index + 1}`,
      created_at: minutesAgo(30 + index * 10),
      like_count: index,
    }),
  );
  return [...biaThread, ...others];
}

/** Seed de comentários por `public_id` de vídeo. */
export function buildSeedComments(): StoredComment[] {
  return [
    ...techCommentsSeed(TECH_VIDEO_ID),
    ...publishedCommentsSeed("published-01"),
  ];
}

// Vídeos de `tech_mastery` assistíveis (spec `watch-social`).
/** Publicado de `tech_mastery` com comentários, 1.2K likes e o Subscribe do canal. */
export const TECH_VIDEO_ID = "tech-01";
/** Publicado de `tech_mastery` cujo `GET /videos/{id}/comments` responde 500. */
export const COMMENTS_DOWN_ID = "comments-down-id";

/** `CommentResponse` pronto (testes de componentes): raiz de `bia`, sem reação do espectador. */
export function buildCommentResponse(overrides: Partial<Comment> = {}): Comment {
  return {
    id: nextCommentId(),
    parent_id: null,
    text: "Comentário",
    author: { nickname: "bia", name: "Bia Souza" },
    created_at: FIXTURE_NOW,
    edited_at: null,
    like_count: 0,
    dislike_count: 0,
    reply_count: 0,
    viewer_reaction: null,
    viewer_is_author: false,
    ...overrides,
  };
}
