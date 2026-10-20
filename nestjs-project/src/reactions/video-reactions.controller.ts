import {
  Body,
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
import { Throttle } from '@nestjs/throttler';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiErrorEnvelope } from '../common/openapi/api-error-envelope.dto';
import { ReactionStateResponse } from './dto/reaction-state-response.dto';
import { SetReactionDto } from './dto/set-reaction.dto';
import { REACTION_THROTTLE } from './reactions.constants';
import { VideoReactionsService } from './video-reactions.service';

const errorEnvelope = { $ref: getSchemaPath(ApiErrorEnvelope) };
const publicIdParam = {
  name: 'publicId',
  description: 'Identificador público do vídeo (11 chars base64url)',
  example: 'dQw4w9WgXcQ',
};

// Mutações set-state idempotentes (social-interactions/TD-03): exigem JWT (guard global), só em
// vídeo `published` (rascunho → 404 inclusive para o dono) e têm throttle próprio de 60 req/min.
@ApiTags('videos')
@ApiBearerAuth('access-token')
@Controller('videos')
export class VideoReactionsController {
  constructor(private readonly reactions: VideoReactionsService) {}

  @Put(':publicId/reaction')
  @HttpCode(HttpStatus.OK)
  @Throttle(REACTION_THROTTLE)
  @ApiOperation({
    summary: 'Define a reação do usuário ao vídeo',
    description:
      'Set-state idempotente (social-interactions/TD-03): cria ou troca a reação (like/dislike); repetir o mesmo valor não muda nada. Responde com o estado resultante e os contadores do vídeo.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({ status: 200, type: ReactionStateResponse })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_ERROR — `value` ausente ou fora do enum',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado',
  })
  @ApiResponse({
    status: 404,
    description:
      'VIDEO_NOT_FOUND — inexistente ou não publicado (inclusive para o dono)',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests — limite de 60 req/min da rota',
  })
  async setReaction(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
    @Body() dto: SetReactionDto,
  ): Promise<ReactionStateResponse> {
    return this.reactions.set(publicId, user.sub, dto.value);
  }

  @Delete(':publicId/reaction')
  @HttpCode(HttpStatus.OK)
  @Throttle(REACTION_THROTTLE)
  @ApiOperation({
    summary: 'Remove a reação do usuário ao vídeo',
    description:
      'Idempotente (social-interactions/TD-03): sem reação, devolve o mesmo estado sem efeito.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({ status: 200, type: ReactionStateResponse })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado',
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND — inexistente ou não publicado',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests — limite de 60 req/min da rota',
  })
  async removeReaction(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
  ): Promise<ReactionStateResponse> {
    return this.reactions.remove(publicId, user.sub);
  }
}
