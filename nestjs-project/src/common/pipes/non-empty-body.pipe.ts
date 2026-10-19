import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Rejeita corpos de `PATCH` sem nenhum campo reconhecido (`### API Contracts → Validation Rules`).
 * Roda depois do `ValidationPipe` global (whitelist + forbidNonWhitelisted), então só sobram
 * campos do DTO; se todos estão ausentes, responde 400 `VALIDATION_ERROR` pelo
 * `ValidationExceptionFilter`. Um campo explicitamente `null` conta como presente.
 */
@Injectable()
export class NonEmptyBodyPipe implements PipeTransform {
  transform<T>(value: T): T {
    const hasField =
      typeof value === 'object' &&
      value !== null &&
      Object.values(value).some((field) => field !== undefined);
    if (!hasField) {
      throw new BadRequestException(['body must contain at least one field']);
    }
    return value;
  }
}
