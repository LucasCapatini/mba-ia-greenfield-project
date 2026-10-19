import { DomainException } from '../common/exceptions/domain.exception';
import { VIDEO_ERROR_CODES } from './videos.constants';

// Exceções de domínio da Fase 03 — mapeadas para HTTP pelo DomainExceptionFilter
// (phase-02-auth/TD-07). Códigos e status conforme `### Error Catalog` do plano.

export class VideoUnsupportedMediaTypeException extends DomainException {
  constructor(contentType: string) {
    super(
      VIDEO_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      400,
      `Content type "${contentType}" is not supported (accepted: video/mp4, video/webm)`,
    );
  }
}

export class VideoTooLargeException extends DomainException {
  constructor(sizeBytes: number, maxBytes: number) {
    super(
      VIDEO_ERROR_CODES.TOO_LARGE,
      413,
      `Video size ${sizeBytes} bytes exceeds the limit of ${maxBytes} bytes`,
    );
  }
}

export class VideoNotFoundException extends DomainException {
  constructor() {
    super(VIDEO_ERROR_CODES.NOT_FOUND, 404, 'Video not found');
  }
}

export class VideoForbiddenException extends DomainException {
  constructor() {
    super(VIDEO_ERROR_CODES.FORBIDDEN, 403, 'You do not own this video');
  }
}

export class UploadNotActiveException extends DomainException {
  constructor(state: string) {
    super(
      VIDEO_ERROR_CODES.UPLOAD_NOT_ACTIVE,
      409,
      `Upload session is not active (state: ${state})`,
    );
  }
}

export class UploadIncompleteException extends DomainException {
  constructor(reason: string) {
    super(
      VIDEO_ERROR_CODES.UPLOAD_INCOMPLETE,
      422,
      `Upload cannot be completed: ${reason}`,
    );
  }
}

export class VideoNotReadyException extends DomainException {
  constructor(processingStatus: string) {
    super(
      VIDEO_ERROR_CODES.NOT_READY,
      409,
      `Video is not ready for playback (processing_status: ${processingStatus})`,
    );
  }
}

/** Erro de validação dependente da sessão (ex.: `part_number` > `part_count`) — mesmo código do ValidationPipe. */
export class UploadPartOutOfRangeException extends DomainException {
  constructor(partNumbers: number[], partCount: number) {
    super(
      'VALIDATION_ERROR',
      400,
      `part_numbers out of range [1, ${partCount}]: ${partNumbers.join(', ')}`,
    );
  }
}

// Exceções de domínio da Fase 04 (video-channel-management — `### Error Catalog`).

export class CategoryNotFoundException extends DomainException {
  constructor(categoryId: string) {
    super(
      VIDEO_ERROR_CODES.CATEGORY_NOT_FOUND,
      400,
      `Category ${categoryId} does not exist`,
    );
  }
}

/** Publicar exige `processing_status = ready` e título não vazio (TD-02). */
export class VideoNotPublishableException extends DomainException {
  constructor(reason: string) {
    super(
      VIDEO_ERROR_CODES.NOT_PUBLISHABLE,
      409,
      `Video cannot be published: ${reason}`,
    );
  }
}

/** Bytes que não decodificam como JPEG/PNG/WebP, tipo declarado fora da lista ou < 640×360 (TD-04). */
export class ThumbnailInvalidException extends DomainException {
  constructor(reason: string) {
    super(
      VIDEO_ERROR_CODES.THUMBNAIL_INVALID,
      400,
      `Invalid thumbnail: ${reason}`,
    );
  }
}

export class ThumbnailTooLargeException extends DomainException {
  constructor(maxBytes: number) {
    super(
      VIDEO_ERROR_CODES.THUMBNAIL_TOO_LARGE,
      413,
      `Thumbnail exceeds the limit of ${maxBytes} bytes`,
    );
  }
}
