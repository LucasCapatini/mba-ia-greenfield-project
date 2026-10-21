import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiErrorEnvelope } from '../common/openapi/api-error-envelope.dto';
import { ListSubscriptionFeedDto } from './dto/list-videos.dto';
import { SubscriptionFeedPage } from './dto/video-pages.dto';
import { VideosListingService } from './videos-listing.service';
import { LISTING_THROTTLE } from './videos.constants';

const errorEnvelope = { $ref: getSchemaPath(ApiErrorEnvelope) };

// Feed das inscrições do próprio usuário (social-interactions/TD-08): exige JWT (guard global).
// Mora no VideosModule porque devolve cards de vídeo (VideosListingService); a lista de canais
// seguidos (`GET /me/subscriptions`) fica no SubscriptionsModule.
@ApiTags('subscriptions')
@ApiBearerAuth('access-token')
@Controller('me/subscriptions')
export class SubscriptionFeedController {
  constructor(private readonly listing: VideosListingService) {}

  @Get('videos')
  @Throttle(LISTING_THROTTLE)
  @ApiOperation({
    summary: 'Feed dos canais seguidos',
    description:
      'Vídeos publicados, públicos e prontos dos canais que o usuário segue, do mais recente ao mais antigo, em cursor keyset. Unlisted, rascunhos e vídeos em processamento ficam de fora.',
  })
  @ApiResponse({ status: 200, type: SubscriptionFeedPage })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_ERROR — `limit` inválido ou `cursor` malformado',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado',
  })
  @ApiResponse({
    status: 429,
    description:
      'Limite de 60 req/min por visitante excedido (home-search-production/TD-01)',
  })
  async feed(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListSubscriptionFeedDto,
  ): Promise<SubscriptionFeedPage> {
    return this.listing.listSubscriptionFeed(user.sub, query);
  }
}
