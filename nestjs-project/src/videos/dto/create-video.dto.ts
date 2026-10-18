import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, MaxLength, Min } from 'class-validator';
import { ALLOWED_VIDEO_MIME_TYPES } from '../video-formats';

// Pré-cadastro do vídeo (POST /videos — SI-03.5). Duas regras ficam no serviço de propósito,
// para responderem com código de domínio em vez de VALIDATION_ERROR (`### API Contracts`):
// a allowlist de MIME (400 VIDEO_UNSUPPORTED_MEDIA_TYPE) e o teto UPLOAD_MAX_BYTES (413 VIDEO_TOO_LARGE).
export class CreateVideoDto {
  /** Nome do arquivo escolhido pelo usuário (sem caminho). */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 255)
  original_filename: string;

  /** MIME type declarado pelo cliente; sem transcodificação, só formatos que tocam nativamente nos navegadores. */
  @ApiProperty({ enum: ALLOWED_VIDEO_MIME_TYPES, example: 'video/mp4' }) // enum não é inferível pelo plugin (validado no serviço)
  @IsString()
  @MaxLength(64)
  content_type: string;

  /** Tamanho total do arquivo em bytes (≤ UPLOAD_MAX_BYTES, 10 GiB por padrão). */
  @IsInt()
  @Min(1)
  size_bytes: number;
}
