import { ApiProperty } from '@nestjs/swagger';

/** Estado resultante de `PUT|DELETE /channels/{nickname}/subscription` (social-interactions/TD-03). */
export class SubscriptionStateResponse {
  @ApiProperty({
    description: 'Se o solicitante segue o canal após a escrita.',
  })
  subscribed: boolean;

  @ApiProperty({ type: 'integer', example: 1200 })
  subscriber_count: number;
}
