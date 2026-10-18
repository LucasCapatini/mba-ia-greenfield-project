import {
  CONTAINER_BY_MIME_TYPE,
  type AllowedVideoMimeType,
} from './video-formats';

const MAX_FILENAME_LENGTH = 200;

/**
 * Nome seguro para `Content-Disposition: attachment; filename="…"` (TD-09): remove aspas, barras,
 * CR/LF e caracteres de controle (quebrariam o header ou permitiriam injeção), colapsa espaços e
 * limita o tamanho. Vazio após a limpeza → `video.<ext>` pelo MIME declarado.
 */
export function sanitizeFilename(
  original: string,
  contentType: string,
): string {
  const cleaned = original
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f"\\/]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FILENAME_LENGTH)
    .trim();
  if (cleaned && cleaned !== '.' && cleaned !== '..') {
    return cleaned;
  }
  const ext =
    CONTAINER_BY_MIME_TYPE[contentType as AllowedVideoMimeType] ?? 'bin';
  return `video.${ext}`;
}

/**
 * Valor literal do header. `filename` fica ASCII (não-ASCII vira `_`); quando houve substituição,
 * `filename*` (RFC 6266/5987) carrega o nome original em UTF-8 para navegadores modernos.
 */
export function attachmentDisposition(
  original: string,
  contentType: string,
): string {
  const name = sanitizeFilename(original, contentType);

  const ascii = name.replace(/[^\x20-\x7e]/g, '_');
  if (ascii === name) {
    return `attachment; filename="${name}"`;
  }
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
