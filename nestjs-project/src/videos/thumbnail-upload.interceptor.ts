import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request, RequestHandler, Response } from 'express';
import multer, { MulterError } from 'multer';
import type { Observable } from 'rxjs';
import uploadConfig from '../config/upload.config';
import { ThumbnailTooLargeException } from './videos.exceptions';

/** Campo multipart da thumbnail (`### API Contracts → PUT /videos/{publicId}/thumbnail`). */
export const THUMBNAIL_FIELD = 'file';

/**
 * Lê o `multipart/form-data` da thumbnail em memória (≤ `THUMBNAIL_MAX_BYTES`) e popula
 * `req.file`. Usa o multer direto em vez do `FileInterceptor` do Nest para que (1) o limite venha
 * do namespace `upload` e (2) o estouro vire 413 `THUMBNAIL_TOO_LARGE` — o `FileInterceptor`
 * responde um 413 genérico fora do envelope de domínio. Qualquer outro erro do multipart (campo
 * inesperado, corpo malformado) vira 400 `VALIDATION_ERROR` pelo `ValidationExceptionFilter`.
 */
@Injectable()
export class ThumbnailUploadInterceptor implements NestInterceptor {
  private readonly parse: RequestHandler;
  private readonly maxBytes: number;

  constructor(
    @Inject(uploadConfig.KEY)
    upload: ConfigType<typeof uploadConfig>,
  ) {
    this.maxBytes = upload.thumbnailMaxBytes;
    this.parse = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: this.maxBytes, files: 1, fields: 0 },
    }).single(THUMBNAIL_FIELD);
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    await new Promise<void>((resolve, reject) => {
      void this.parse(request, response, (error?: unknown) => {
        if (error) {
          reject(this.toException(error));
          return;
        }
        resolve();
      });
    });
    return next.handle();
  }

  private toException(error: unknown): Error {
    if (error instanceof MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return new ThumbnailTooLargeException(this.maxBytes);
      }
      const field = error.field ? ` (${error.field})` : '';
      return new BadRequestException([`${error.message}${field}`]);
    }
    return new BadRequestException(['malformed multipart/form-data body']);
  }
}
