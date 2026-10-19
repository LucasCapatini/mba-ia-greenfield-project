import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  VIDEO_TITLE_MAX_LENGTH,
  VIDEO_VISIBILITIES,
  type VideoVisibility,
} from '../videos.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Comprimento máximo da descrição (`### API Contracts → Validation Rules`). */
export const VIDEO_DESCRIPTION_MAX_LENGTH = 5000;

// Edição parcial dos campos editoriais (PATCH /videos/{publicId} — video-channel-management/TD-03).
// Nunca muda `status`: publicar/despublicar são ações dedicadas. `status` e qualquer outro campo
// são rejeitados pelo `forbidNonWhitelisted` global; o corpo vazio, pelo `NonEmptyBodyPipe`.
// `title`/`visibility` usam `ValidateIf` (e não `IsOptional`) para recusar `null`: as colunas
// não aceitam nulo. `description`/`category_id` aceitam `null` para limpar o valor.
export class UpdateVideoDto {
  /** Título exibido (1..100 caracteres após trim). */
  @ApiProperty({ required: false, minLength: 1, maxLength: 100 })
  @ValidateIf((dto: UpdateVideoDto) => dto.title !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, VIDEO_TITLE_MAX_LENGTH)
  title?: string;

  @ApiProperty({
    type: String,
    nullable: true,
    required: false,
    maxLength: VIDEO_DESCRIPTION_MAX_LENGTH,
    description: 'Descrição livre; `null` remove.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(VIDEO_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    required: false,
    description: 'Categoria de `GET /categories`; `null` remove.',
  })
  @IsOptional()
  @IsUUID()
  category_id?: string | null;

  @ApiProperty({
    enum: VIDEO_VISIBILITIES,
    required: false,
    description: 'Só tem efeito quando o vídeo está `published`.',
  })
  @ValidateIf((dto: UpdateVideoDto) => dto.visibility !== undefined)
  @IsIn(VIDEO_VISIBILITIES)
  visibility?: VideoVisibility;
}
