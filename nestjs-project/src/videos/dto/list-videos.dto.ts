import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '../../common/pagination/cursor-page.dto';
import { IsNotBefore } from '../../common/validation/is-not-before.validator';
import {
  RELATED_VIDEOS_DEFAULT_LIMIT,
  RELATED_VIDEOS_MAX_LIMIT,
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_QUERY_MIN_LENGTH,
  VIDEO_PROCESSING_STATUSES,
  VIDEO_STATUSES,
  VIDEO_VISIBILITIES,
  type VideoProcessingStatus,
  type VideoStatus,
  type VideoVisibility,
} from '../videos.constants';

export const OWNER_VIDEO_SORTS = ['latest', 'oldest', 'views'] as const;
export type OwnerVideoSort = (typeof OWNER_VIDEO_SORTS)[number];

export const CHANNEL_VIDEO_SORTS = ['latest', 'popular', 'oldest'] as const;
export type ChannelVideoSort = (typeof CHANNEL_VIDEO_SORTS)[number];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'must be a date in the YYYY-MM-DD format';

// Paginação keyset compartilhada (video-channel-management/TD-06). Query strings chegam como
// texto: `@Type(() => Number)` converte `limit` antes do `@IsInt`. Exportada para as listagens de
// comentários e inscrições (Fase 06), que seguem o mesmo contrato de `limit`/`cursor`.
export class CursorPageQuery {
  /** Itens por página (1..50). */
  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_LIMIT,
    default: DEFAULT_PAGE_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit: number = DEFAULT_PAGE_LIMIT;

  /** Cursor opaco devolvido em `next_cursor` pela página anterior. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;
}

/** `GET /channels/me/videos` — painel do dono. */
export class ListOwnerVideosDto extends CursorPageQuery {
  // Uniões de literais não são inferidas pelo plugin do Swagger (sairiam como `Object`).
  @ApiPropertyOptional({ enum: VIDEO_STATUSES })
  @IsOptional()
  @IsIn(VIDEO_STATUSES)
  status?: VideoStatus;

  @ApiPropertyOptional({ enum: VIDEO_VISIBILITIES })
  @IsOptional()
  @IsIn(VIDEO_VISIBILITIES)
  visibility?: VideoVisibility;

  @ApiPropertyOptional({ enum: VIDEO_PROCESSING_STATUSES })
  @IsOptional()
  @IsIn(VIDEO_PROCESSING_STATUSES)
  processing_status?: VideoProcessingStatus;

  /** Busca no título, sem diferenciar maiúsculas (máx. 100 caracteres). */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  q?: string;

  /** `latest` (padrão, criação decrescente), `oldest` ou `views`. */
  @ApiPropertyOptional({ enum: OWNER_VIDEO_SORTS, default: 'latest' })
  @IsOptional()
  @IsIn(OWNER_VIDEO_SORTS)
  sort: OwnerVideoSort = 'latest';

  /** Criados a partir deste dia (inclusive). */
  @IsOptional()
  @Matches(DATE_ONLY, { message: `from ${DATE_MESSAGE}` })
  @IsISO8601({ strict: true })
  from?: string;

  /** Criados até este dia (inclusive); não pode ser anterior a `from`. */
  @IsOptional()
  @Matches(DATE_ONLY, { message: `to ${DATE_MESSAGE}` })
  @IsISO8601({ strict: true })
  @IsNotBefore('from')
  to?: string;
}

/**
 * `GET /videos/{publicId}/related` — sugestões da watch page. Lista fechada, sem cursor
 * (watch-page/TD-04, Revisions 2026-10-19).
 */
export class RelatedVideosQuery {
  /** Quantidade de sugestões (1..24). */
  @ApiPropertyOptional({
    minimum: 1,
    maximum: RELATED_VIDEOS_MAX_LIMIT,
    default: RELATED_VIDEOS_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RELATED_VIDEOS_MAX_LIMIT)
  limit: number = RELATED_VIDEOS_DEFAULT_LIMIT;
}

/** `GET /channels/{nickname}/videos` — página pública do canal. */
export class ListChannelVideosDto extends CursorPageQuery {
  /** `latest` (padrão, publicação decrescente), `popular` (views) ou `oldest`. */
  @ApiPropertyOptional({ enum: CHANNEL_VIDEO_SORTS, default: 'latest' })
  @IsOptional()
  @IsIn(CHANNEL_VIDEO_SORTS)
  sort: ChannelVideoSort = 'latest';
}

/** `GET /me/subscriptions/videos` — feed das inscrições, sempre do mais recente (TD-08). */
export class ListSubscriptionFeedDto extends CursorPageQuery {}

/**
 * `GET /videos` — listagem pública global da home e da busca (home-search-production/TD-01,
 * TD-02): sempre do mais recente ao mais antigo, inclusive com `q` (TD-03).
 */
export class ListPublicVideosDto extends CursorPageQuery {
  /** `slug` da categoria; sem correspondência → 404 CATEGORY_NOT_FOUND. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  /**
   * Termo de busca (2..100 caracteres após `trim`): casa por substring, sem acento nem caixa, o
   * título do vídeo ou o nome/nickname do canal.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(SEARCH_QUERY_MIN_LENGTH, SEARCH_QUERY_MAX_LENGTH)
  q?: string;
}
