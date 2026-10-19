// Estados e códigos do domínio de vídeo (phase-03-upload-processing/TD-07, TD-11, TD-12, TD-14).
// Os valores são o contrato exposto pela API (`### Data Model` do plano da fase).

/** Eixo de publicação (video-channel-management/TD-02): `draft → published` exige `ready` + título. */
export const VIDEO_STATUSES = ['draft', 'published'] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

/** Visibilidade (TD-02): editável a qualquer momento; só tem efeito quando `status = published`. */
export const VIDEO_VISIBILITIES = ['public', 'unlisted'] as const;
export type VideoVisibility = (typeof VIDEO_VISIBILITIES)[number];

/** Eixo de processamento: uploading → processing → ready | failed. */
export const VIDEO_PROCESSING_STATUSES = [
  'uploading',
  'processing',
  'ready',
  'failed',
] as const;
export type VideoProcessingStatus = (typeof VIDEO_PROCESSING_STATUSES)[number];

/** Códigos gravados em `videos.processing_error` pelo worker (não são respostas HTTP). */
export const VIDEO_PROCESSING_ERRORS = [
  'UNSUPPORTED_FORMAT',
  'PROBE_FAILED',
  'THUMBNAIL_FAILED',
  'OBJECT_MISSING',
] as const;
export type VideoProcessingError = (typeof VIDEO_PROCESSING_ERRORS)[number];

/** Estado da sessão multipart transitória (`video_uploads.state`). */
export const VIDEO_UPLOAD_STATES = [
  'active',
  'completed',
  'aborted',
  'expired',
] as const;
export type VideoUploadState = (typeof VIDEO_UPLOAD_STATES)[number];

export const VIDEO_ERROR_CODES = {
  UNSUPPORTED_MEDIA_TYPE: 'VIDEO_UNSUPPORTED_MEDIA_TYPE',
  TOO_LARGE: 'VIDEO_TOO_LARGE',
  NOT_FOUND: 'VIDEO_NOT_FOUND',
  FORBIDDEN: 'VIDEO_FORBIDDEN',
  UPLOAD_NOT_ACTIVE: 'UPLOAD_NOT_ACTIVE',
  UPLOAD_INCOMPLETE: 'UPLOAD_INCOMPLETE',
  NOT_READY: 'VIDEO_NOT_READY',
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  NOT_PUBLISHABLE: 'VIDEO_NOT_PUBLISHABLE',
  THUMBNAIL_INVALID: 'THUMBNAIL_INVALID',
  THUMBNAIL_TOO_LARGE: 'THUMBNAIL_TOO_LARGE',
} as const;

/** Limite do título (`videos.title` varchar(100)). */
export const VIDEO_TITLE_MAX_LENGTH = 100;
