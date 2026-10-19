import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { ThumbnailInvalidException } from './videos.exceptions';

/** Tipos aceitos no upload — declarados pelo cliente E confirmados pelos bytes (TD-04). */
export const THUMBNAIL_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
const THUMBNAIL_FORMATS = ['jpeg', 'png', 'webp'] as const;

export const THUMBNAIL_MIN_WIDTH = 640;
export const THUMBNAIL_MIN_HEIGHT = 360;
export const THUMBNAIL_OUTPUT = { width: 1280, height: 720, quality: 85 };

/**
 * Valida e normaliza a thumbnail customizada (video-channel-management/TD-04): o tipo declarado
 * precisa estar na lista, os bytes precisam decodificar como JPEG/PNG/WebP com pelo menos
 * 640×360 (já com a orientação EXIF aplicada) e a saída é sempre JPEG 1280×720 (`cover`), sem
 * metadados — o storage nunca recebe o arquivo original.
 */
@Injectable()
export class ThumbnailProcessor {
  async normalize(buffer: Buffer, declaredMimeType: string): Promise<Buffer> {
    if (
      !(THUMBNAIL_MIME_TYPES as readonly string[]).includes(declaredMimeType)
    ) {
      throw new ThumbnailInvalidException(
        `type ${declaredMimeType} is not supported (accepted: ${THUMBNAIL_MIME_TYPES.join(', ')})`,
      );
    }

    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(buffer).metadata();
    } catch {
      throw new ThumbnailInvalidException('the file is not a decodable image');
    }
    if (!(THUMBNAIL_FORMATS as readonly string[]).includes(metadata.format)) {
      throw new ThumbnailInvalidException(
        `image format ${metadata.format} is not supported`,
      );
    }
    const { width, height } = metadata.autoOrient;
    if (width < THUMBNAIL_MIN_WIDTH || height < THUMBNAIL_MIN_HEIGHT) {
      throw new ThumbnailInvalidException(
        `image is ${width}×${height}; the minimum is ${THUMBNAIL_MIN_WIDTH}×${THUMBNAIL_MIN_HEIGHT}`,
      );
    }

    try {
      return await sharp(buffer)
        .autoOrient()
        .resize(THUMBNAIL_OUTPUT.width, THUMBNAIL_OUTPUT.height, {
          fit: 'cover',
        })
        .jpeg({ quality: THUMBNAIL_OUTPUT.quality })
        .toBuffer();
    } catch {
      // Header válido mas pixels corrompidos (`failOn: 'warning'` por padrão).
      throw new ThumbnailInvalidException('the image data is corrupt');
    }
  }
}
