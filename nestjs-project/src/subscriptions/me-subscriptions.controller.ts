import { Controller, Get, Query } from '@nestjs/common';
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
import { ListSubscriptionsQuery } from './dto/list-subscriptions.dto';
import { SubscribedChannelsPage } from './dto/subscribed-channels-page.dto';
import { SubscriptionsService } from './subscriptions.service';

const errorEnvelope = { $ref: getSchemaPath(ApiErrorEnvelope) };

// Área de canais seguidos do próprio usuário (social-interactions/TD-08): exige JWT (guard global)
// e cada usuário só lê as próprias inscrições. O feed de vídeos (`GET /me/subscriptions/videos`)
// fica no VideosModule, dono da listagem de cards.
@ApiTags('subscriptions')
@ApiBearerAuth('access-token')
@Controller('me/subscriptions')
export class MeSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Canais seguidos pelo usuário',
    description:
      'Canais seguidos em ordem alfabética do nome (desempate por id), em cursor keyset. O menu lateral pede os 7 primeiros (`limit=7`) e "Show more" segue o `next_cursor`.',
  })
  @ApiResponse({ status: 200, type: SubscribedChannelsPage })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_ERROR — `limit` inválido ou `cursor` malformado',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado',
  })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListSubscriptionsQuery,
  ): Promise<SubscribedChannelsPage> {
    return this.subscriptions.listChannels(user.sub, query);
  }
}
