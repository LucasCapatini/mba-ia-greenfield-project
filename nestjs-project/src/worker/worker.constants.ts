// Parâmetros do processamento de vídeo (phase-03-upload-processing/TD-06, TD-13).

/** `ffprobe` lê só os cabeçalhos pela URL assinada; 60 s cobre arquivos grandes em storage lento. */
export const FFPROBE_TIMEOUT_MS = 60_000;
/** Extração de um único frame; o `-ss` antes do `-i` faz seek por índice, sem decodificar tudo. */
export const FFMPEG_FRAME_TIMEOUT_MS = 120_000;
/** Saída de erro mantida em `processing_error_detail` (coluna `text`, mas o log precisa caber). */
export const PROCESSING_ERROR_DETAIL_MAX = 500;

export const THUMBNAIL = {
  width: 640,
  /** `-q:v` do mjpeg: 2 (melhor) … 31 (pior). */
  quality: 3,
  contentType: 'image/jpeg',
} as const;

export const VIDEO_PROCESS_WORK_OPTIONS = {
  batchSize: 1,
  pollingIntervalSeconds: 2,
} as const;

/** Expiração é barata (abort + delete): lotes de 5 por polling. */
export const UPLOAD_EXPIRE_WORK_OPTIONS = {
  batchSize: 5,
  pollingIntervalSeconds: 2,
} as const;

/** Validade da URL interna usada pelo ffprobe/ffmpeg (maior que `expireInSeconds` do job). */
export const PROCESSING_URL_TTL_SECONDS = 3_600;

/** Exclusão é barata (alguns DeleteObject): lotes de 5 por polling (video-channel-management/TD-09). */
export const VIDEO_DELETE_WORK_OPTIONS = {
  batchSize: 5,
  pollingIntervalSeconds: 2,
} as const;
