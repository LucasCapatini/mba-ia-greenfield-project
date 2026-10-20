import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiErrorEnvelope } from '../common/openapi/api-error-envelope.dto';
import { SubscriptionStateResponse } from './dto/subscription-state-response.dto';
import { SubscriptionsService } from './subscriptions.service';

const errorEnvelope = { $ref: getSchemaPath(ApiErrorEnvelope) };
const nicknameParam = {
  name: 'nickname',
  description: 'Nickname do canal',
  example: 'tech_mastery',
};

// Inscrição como sub-recurso do canal (social-interactions/TD-03): set-state idempotente, JWT
// obrigatório (guard global); inscrever-se no próprio canal → 422.
@ApiTags('channels')
@ApiBearerAuth('access-token')
@Controller('channels')
export class ChannelSubscriptionController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Put(':nickname/subscription')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inscreve o usuário no canal',
    description:
      'Idempotente (social-interactions/TD-03): repetir não muda nada. Responde com o estado e a contagem de inscritos do canal.',
  })
  @ApiParam(nicknameParam)
  @ApiResponse({ status: 200, type: SubscriptionStateResponse })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado',
  })
  @ApiResponse({
    status: 404,
    description: 'CHANNEL_NOT_FOUND — nickname inexistente',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 422,
    description: 'CANNOT_SUBSCRIBE_OWN_CHANNEL — o canal é do próprio usuário',
    schema: errorEnvelope,
  })
  async subscribe(
    @CurrentUser() user: JwtPayload,
    @Param('nickname') nickname: string,
  ): Promise<SubscriptionStateResponse> {
    return this.subscriptions.subscribe(user.sub, nickname);
  }

  @Delete(':nickname/subscription')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancela a inscrição no canal',
    description:
      'Idempotente (social-interactions/TD-03): sem inscrição, devolve o mesmo estado sem efeito.',
  })
  @ApiParam(nicknameParam)
  @ApiResponse({ status: 200, type: SubscriptionStateResponse })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado',
  })
  @ApiResponse({
    status: 404,
    description: 'CHANNEL_NOT_FOUND — nickname inexistente',
    schema: errorEnvelope,
  })
  async unsubscribe(
    @CurrentUser() user: JwtPayload,
    @Param('nickname') nickname: string,
  ): Promise<SubscriptionStateResponse> {
    return this.subscriptions.unsubscribe(user.sub, nickname);
  }
}
