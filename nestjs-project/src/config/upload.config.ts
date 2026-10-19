import { registerAs } from '@nestjs/config';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

// Política de upload/playback — phase-03-upload-processing/TD-03, TD-09, TD-12.
// Tamanhos em bytes; TTLs em segundos. `partSize` mínimo de 5 MiB é limite do S3
// (validado no schema Joi); os testes o reduzem para provar multipart sem 10 GiB.
export default registerAs('upload', () => ({
  partSize: parseInt(process.env.UPLOAD_PART_SIZE || String(64 * MIB), 10),
  maxBytes: parseInt(process.env.UPLOAD_MAX_BYTES || String(10 * GIB), 10),
  urlTtlSeconds: parseInt(process.env.UPLOAD_URL_TTL || '3600', 10),
  sessionTtlSeconds: parseInt(process.env.UPLOAD_TTL || '86400', 10),
  playbackUrlTtlSeconds: parseInt(process.env.PLAYBACK_URL_TTL || '43200', 10),
  /** Teto da thumbnail customizada (video-channel-management/TD-04). */
  thumbnailMaxBytes: parseInt(
    process.env.THUMBNAIL_MAX_BYTES || String(5 * MIB),
    10,
  ),
}));
