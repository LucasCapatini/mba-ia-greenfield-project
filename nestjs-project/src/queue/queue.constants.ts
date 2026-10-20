// Filas (phase-03-upload-processing/TD-04, TD-11, TD-12; video-channel-management/TD-09) e seus
// defaults de envio.
// Produtor: API (VideosService). Consumidor: processo video-worker (TD-05).

export const QUEUE_NAMES = {
  /** Processamento do vídeo após o `complete` do upload (ffprobe + thumbnail) — TD-11. */
  VIDEO_PROCESS: 'video.process',
  /** Expiração da sessão multipart não concluída dentro de UPLOAD_TTL — TD-12. */
  UPLOAD_EXPIRE: 'upload.expire',
  /** Remoção dos objetos de um vídeo excluído (hard delete) — video-channel-management/TD-09. */
  VIDEO_DELETE: 'video.delete',
  /** Limpeza diária dos baldes vencidos de `video_views` (cron, UTC) — watch-page/TD-02. */
  VIDEO_VIEWS_CLEANUP: 'video-views.cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Política das filas (pg-boss ≥ 10): `singletonKey` só deduplica sob `short`/`singleton`/
 * `stately`/`exclusive`; na `standard` ele é ignorado. `exclusive` = no máximo 1 job por chave
 * na fila OU ativo — o contrato "um job por vídeo" de TD-11/TD-12. A política é imutável após
 * `createQueue`; mudar exige apagar e recriar a fila.
 */
export const QUEUE_POLICY = 'exclusive' as const;

export interface VideoProcessPayload {
  videoId: string;
}

export interface UploadExpirePayload {
  videoId: string;
}

/**
 * As chaves vão no payload porque a linha de `videos` já foi apagada quando o job roda (TD-09);
 * `thumbnailKeys` lista só as chaves não nulas no momento da exclusão.
 */
export interface VideoDeletePayload {
  videoId: string;
  publicId: string;
  storageKey: string;
  thumbnailKeys: string[];
}

/** Job agendado sem dados: o handler apaga tudo o que venceu no momento em que roda. */
export type VideoViewsCleanupPayload = Record<string, never>;

export interface QueuePayloads {
  [QUEUE_NAMES.VIDEO_PROCESS]: VideoProcessPayload;
  [QUEUE_NAMES.UPLOAD_EXPIRE]: UploadExpirePayload;
  [QUEUE_NAMES.VIDEO_DELETE]: VideoDeletePayload;
  [QUEUE_NAMES.VIDEO_VIEWS_CLEANUP]: VideoViewsCleanupPayload;
}

/** Chaves singleton: um job ativo por vídeo em cada fila (idempotência, TD-11/TD-12). */
export const singletonKeys = {
  videoProcess: (videoId: string) => `video:${videoId}`,
  uploadExpire: (videoId: string) => `upload:${videoId}`,
  videoDelete: (videoId: string) => `video-delete:${videoId}`,
} as const;

export interface QueueSendDefaults {
  retryLimit: number;
  /** Segundos entre tentativas (com backoff exponencial quando `retryBackoff`). */
  retryDelay: number;
  retryBackoff: boolean;
  /** Job ativo sem conclusão por mais que isto volta à fila (worker travado). */
  expireInSeconds: number;
}

export const QUEUE_SEND_DEFAULTS: Readonly<
  Record<QueueName, QueueSendDefaults>
> = {
  [QUEUE_NAMES.VIDEO_PROCESS]: {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 1800,
  },
  [QUEUE_NAMES.UPLOAD_EXPIRE]: {
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 300,
  },
  [QUEUE_NAMES.VIDEO_DELETE]: {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 300,
  },
  [QUEUE_NAMES.VIDEO_VIEWS_CLEANUP]: {
    retryLimit: 3,
    retryDelay: 300,
    retryBackoff: true,
    expireInSeconds: 300,
  },
};
