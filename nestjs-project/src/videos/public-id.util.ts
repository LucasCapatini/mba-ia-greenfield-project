import { randomBytes } from 'crypto';

// Identificador público do vídeo (phase-03-upload-processing/TD-08): 11 caracteres no alfabeto
// URL-safe [A-Za-z0-9_-] (64 bits de entropia — mesmo formato dos IDs do YouTube), gerado no
// pré-cadastro e usado na URL pública e como prefixo das chaves no storage. A PK continua UUID;
// colisões (~1e-19 por inserção) são tratadas pelo serviço com retry por SAVEPOINT.

export const PUBLIC_ID_LENGTH = 11;
export const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function generatePublicId(): string {
  // 8 bytes → 11 caracteres base64url (sem padding).
  return randomBytes(8).toString('base64url').slice(0, PUBLIC_ID_LENGTH);
}

export function isValidPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value);
}

export interface VideoStorageKeys {
  /** Objeto do vídeo enviado pelo usuário (multipart). */
  source: string;
  /** Thumbnail gerada pelo worker a partir de um frame. */
  thumbnail: string;
  /** Thumbnail customizada enviada pelo dono (video-channel-management/TD-04). */
  customThumbnail: string;
}

export function storageKeys(publicId: string): VideoStorageKeys {
  return {
    source: `videos/${publicId}/source`,
    thumbnail: `thumbnails/${publicId}/auto.jpg`,
    customThumbnail: `thumbnails/${publicId}/custom.jpg`,
  };
}
