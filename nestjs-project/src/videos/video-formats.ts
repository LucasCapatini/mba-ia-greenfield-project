// Allowlist de formatos aceitos (phase-03-videos/TD-14) — constante ÚNICA
// compartilhada pelo DTO de pré-cadastro (SI-03.5), pelo validador do worker (SI-03.8)
// e, via openapi.json, pela futura UI. Sem transcodificação na fase, "aceito" significa
// "toca nativamente em todos os navegadores": MP4 (H.264/AAC) e WebM (VP8/VP9/AV1/Opus).
// HEVC e MOV ficam fora por suporte parcial (reavaliar quando houver transcodificação).

export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;
export type AllowedVideoMimeType = (typeof ALLOWED_VIDEO_MIME_TYPES)[number];

export const VIDEO_CONTAINERS = ['mp4', 'webm'] as const;
export type VideoContainer = (typeof VIDEO_CONTAINERS)[number];

/**
 * `format_name` do ffprobe → container normalizado. O ffprobe devolve nomes compostos
 * (`mov,mp4,m4a,3gp,3g2,mj2`, `matroska,webm`); a normalização olha os tokens.
 */
export const CONTAINER_BY_FFPROBE_FORMAT: Readonly<
  Record<string, VideoContainer>
> = {
  mp4: 'mp4',
  mov: 'mp4',
  m4a: 'mp4',
  '3gp': 'mp4',
  '3g2': 'mp4',
  mj2: 'mp4',
  webm: 'webm',
  matroska: 'webm',
};

export const ALLOWED_VIDEO_CODECS = ['h264', 'vp8', 'vp9', 'av1'] as const;
export type AllowedVideoCodec = (typeof ALLOWED_VIDEO_CODECS)[number];

export const ALLOWED_AUDIO_CODECS = ['aac', 'opus', 'vorbis', 'mp3'] as const;
export type AllowedAudioCodec = (typeof ALLOWED_AUDIO_CODECS)[number];

/** Container que cada MIME declarado deve produzir no `ffprobe` (coerência declaração ↔ bytes). */
export const CONTAINER_BY_MIME_TYPE: Readonly<
  Record<AllowedVideoMimeType, VideoContainer>
> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};
