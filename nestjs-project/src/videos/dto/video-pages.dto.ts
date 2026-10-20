import { ApiProperty } from '@nestjs/swagger';
import type {
  CountedCursorPage,
  CursorPage,
} from '../../common/pagination/cursor-page.dto';
import { VideoCardItem, VideoListItem } from './video-response.dto';

// Páginas keyset concretas para o Swagger (video-channel-management/TD-06).

/** `GET /channels/me/videos`. */
export class OwnerVideosPage implements CountedCursorPage<VideoListItem> {
  @ApiProperty({ type: [VideoListItem] })
  items: VideoListItem[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cursor da próxima página; `null` na última.',
  })
  next_cursor: string | null;

  @ApiProperty({
    type: 'integer',
    description: 'Total de vídeos que atendem aos filtros (ignora o cursor).',
  })
  total: number;
}

/** `GET /videos/{publicId}/related` — lista fechada, sem `next_cursor` (watch-page/TD-04). */
export class RelatedVideosResponse {
  @ApiProperty({ type: [VideoCardItem] })
  items: VideoCardItem[];
}

/** `GET /channels/{nickname}/videos`. */
export class ChannelVideosPage implements CursorPage<VideoCardItem> {
  @ApiProperty({ type: [VideoCardItem] })
  items: VideoCardItem[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cursor da próxima página; `null` na última.',
  })
  next_cursor: string | null;
}

/** `GET /videos` — listagem pública da home e da busca (home-search-production/TD-01, TD-02). */
export class PublicVideosPage implements CursorPage<VideoCardItem> {
  @ApiProperty({ type: [VideoCardItem] })
  items: VideoCardItem[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cursor da próxima página; `null` na última.',
  })
  next_cursor: string | null;
}

/** `GET /me/subscriptions/videos` — feed das inscrições (social-interactions/TD-08). */
export class SubscriptionFeedPage implements CursorPage<VideoCardItem> {
  @ApiProperty({ type: [VideoCardItem] })
  items: VideoCardItem[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cursor da próxima página; `null` na última.',
  })
  next_cursor: string | null;
}
