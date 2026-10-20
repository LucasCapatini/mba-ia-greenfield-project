import { ApiProperty } from '@nestjs/swagger';
import type { CursorPage } from '../../common/pagination/cursor-page.dto';
import { VideoCardChannel } from '../../videos/dto/video-response.dto';

/** `GET /me/subscriptions` — canais seguidos em ordem alfabética (social-interactions/TD-08). */
export class SubscribedChannelsPage implements CursorPage<VideoCardChannel> {
  @ApiProperty({ type: [VideoCardChannel] })
  items: VideoCardChannel[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cursor da próxima página; `null` na última.',
  })
  next_cursor: string | null;
}
