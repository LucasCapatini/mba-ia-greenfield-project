import {
  ALLOWED_AUDIO_CODECS,
  ALLOWED_VIDEO_CODECS,
  CONTAINER_BY_FFPROBE_FORMAT,
  type VideoContainer,
} from '../videos/video-formats';
import type { ProbeResult } from './ffmpeg.service';
import { UnsupportedFormatError } from './worker.errors';

export interface ValidatedFormat {
  container: VideoContainer;
  videoCodec: string;
  audioCodec: string | null;
}

/**
 * `format_name` do ffprobe é composto (`mov,mp4,m4a,3gp,3g2,mj2`, `matroska,webm`): o container
 * é o primeiro token reconhecido na allowlist. Um `.mkv` real também aparece como `matroska,webm`
 * — a distinção vem do codec (HEVC/AC-3 nunca passam), não do container (TD-14).
 */
export function normalizeContainer(formatName: string): VideoContainer | null {
  for (const token of formatName
    .split(',')
    .map((t) => t.trim().toLowerCase())) {
    const container = CONTAINER_BY_FFPROBE_FORMAT[token];
    if (container) {
      return container;
    }
  }
  return null;
}

/** Segunda validação da allowlist (a primeira é o MIME declarado no pré-cadastro, SI-03.5). */
export function validateProbe(result: ProbeResult): ValidatedFormat {
  const container = normalizeContainer(result.formatName);
  if (!container) {
    throw new UnsupportedFormatError(
      `container "${result.formatName}" is not one of mp4/webm`,
    );
  }
  if (!result.videoStream) {
    throw new UnsupportedFormatError('no video stream found');
  }
  const videoCodec = result.videoStream.codec.toLowerCase();
  if (!(ALLOWED_VIDEO_CODECS as readonly string[]).includes(videoCodec)) {
    throw new UnsupportedFormatError(
      `video codec "${videoCodec}" is not one of ${ALLOWED_VIDEO_CODECS.join('/')}`,
    );
  }
  const audioCodec = result.audioStream?.codec.toLowerCase() ?? null;
  if (
    audioCodec &&
    !(ALLOWED_AUDIO_CODECS as readonly string[]).includes(audioCodec)
  ) {
    throw new UnsupportedFormatError(
      `audio codec "${audioCodec}" is not one of ${ALLOWED_AUDIO_CODECS.join('/')}`,
    );
  }
  return { container, videoCodec, audioCodec };
}
