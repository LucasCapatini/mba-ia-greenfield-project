import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  CHANNEL_DESCRIPTION_MAX_LENGTH,
  CHANNEL_NAME_MAX_LENGTH,
  NICKNAME_PATTERN,
  RESERVED_NICKNAMES,
} from '../channels.constants';

// Edição parcial do próprio canal (PATCH /channels/me — video-channel-management/TD-08). O corpo
// vazio é recusado pelo `NonEmptyBodyPipe`; campos desconhecidos, pelo `forbidNonWhitelisted`.
// `nickname`/`name` usam `ValidateIf` (e não `IsOptional`) para recusar `null`: as colunas não
// aceitam nulo. `description` aceita `null` para limpar.
export class UpdateChannelDto {
  /** Identificador público do canal, sem `@` (o `@` é só prefixo visual). */
  @ApiProperty({
    required: false,
    pattern: NICKNAME_PATTERN.source,
    example: 'tech_mastery',
    description: `Minúsculas, dígitos e \`_\` (3..50); reservados: ${RESERVED_NICKNAMES.join(', ')}.`,
  })
  @ValidateIf((dto: UpdateChannelDto) => dto.nickname !== undefined)
  @IsString()
  @Matches(NICKNAME_PATTERN, {
    message:
      'nickname must have 3 to 50 lowercase letters, digits or underscores',
  })
  @IsNotIn(RESERVED_NICKNAMES, { message: 'nickname is reserved' })
  nickname?: string;

  /** Nome de exibição do canal (1..50 caracteres após trim). */
  @ApiProperty({ required: false, minLength: 1, maxLength: 50 })
  @ValidateIf((dto: UpdateChannelDto) => dto.name !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, CHANNEL_NAME_MAX_LENGTH)
  name?: string;

  @ApiProperty({
    type: String,
    nullable: true,
    required: false,
    maxLength: CHANNEL_DESCRIPTION_MAX_LENGTH,
    description: 'Sobre o canal; `null` remove.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(CHANNEL_DESCRIPTION_MAX_LENGTH)
  description?: string | null;
}
