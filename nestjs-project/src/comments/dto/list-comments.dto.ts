import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CursorPageQuery } from '../../videos/dto/list-videos.dto';
import { COMMENT_SORTS, type CommentSort } from '../comments.constants';

/** `GET /videos/{publicId}/comments` — raízes paginadas (social-interactions/TD-06). */
export class ListCommentsQuery extends CursorPageQuery {
  // Uniões de literais não são inferidas pelo plugin do Swagger (sairiam como `Object`).
  @ApiPropertyOptional({ enum: COMMENT_SORTS, default: 'latest' })
  @IsOptional()
  @IsIn(COMMENT_SORTS)
  sort: CommentSort = 'latest';
}

/** `GET /comments/{commentId}/replies` — sempre cronológica, só `cursor`/`limit` (TD-06). */
export class ListRepliesQuery extends CursorPageQuery {}
