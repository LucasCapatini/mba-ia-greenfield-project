import { PROCESSING_ERROR_DETAIL_MAX } from './worker.constants';

/** Resume a saída de um processo para caber em `processing_error_detail` e nos logs. */
export function truncateDetail(detail: string): string {
  const compact = detail.replace(/\s+/g, ' ').trim();
  return compact.length > PROCESSING_ERROR_DETAIL_MAX
    ? `${compact.slice(0, PROCESSING_ERROR_DETAIL_MAX - 1)}…`
    : compact;
}

// Erros do pipeline do worker. Não são exceções de domínio HTTP: viram `processing_error`
// na tabela `videos` (phase-03-videos/TD-06, TD-14) ou retry do pg-boss (TD-11).

export class ProbeFailedError extends Error {
  readonly detail: string;
  constructor(detail: string) {
    super(`ffprobe failed: ${truncateDetail(detail)}`);
    this.name = 'ProbeFailedError';
    this.detail = truncateDetail(detail);
  }
}

export class ThumbnailFailedError extends Error {
  readonly detail: string;
  constructor(detail: string) {
    super(`ffmpeg frame extraction failed: ${truncateDetail(detail)}`);
    this.name = 'ThumbnailFailedError';
    this.detail = truncateDetail(detail);
  }
}

export class UnsupportedFormatError extends Error {
  readonly detail: string;
  constructor(detail: string) {
    super(`unsupported format: ${truncateDetail(detail)}`);
    this.name = 'UnsupportedFormatError';
    this.detail = truncateDetail(detail);
  }
}
