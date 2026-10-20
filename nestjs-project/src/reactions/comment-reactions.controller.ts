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
import { CommentReactionsService } from './comment-reactions.service';
import { ReactionStateResponse } from './dto/reaction-state-response.dto';
import { SetReactionDto } from './dto/set-reaction.dto';
import { REACTION_THROTTLE } from './reactions.constants';

const errorEnvelope = { $ref: getSchemaPath(ApiErrorEnvelope) };
const commentIdParam = {
  name: 'commentId',
  description: 'Id (uuid) do comentário ou resposta; malformado → 404',
  format: 'uuid',
};

// Mutações set-state idempotentes (social-interactions/TD-03), iguais às do vídeo: exigem JWT
// (guard global), valem para raízes e respostas de vídeos `published` e têm throttle de 60 req/min.
@ApiTags('comments')
@ApiBearerAuth('access-token')
@Controller('comments')
export class CommentReactionsController {
  constructor(private readonly reactions: CommentReactionsService) {}

  @Put(':commentId/reaction')
  @HttpCode(HttpStatus.OK)
  @Throttle(REACTION_THROTTLE)
  @ApiOperation({
    summary: 'Define a reação do usuário ao comentário',
    description:
      'Set-state idempotente (social-interactions/TD-03): cria ou troca a reação (like/dislike); repetir o mesmo valor não muda nada. Responde com o estado resultante e os contadores do comentário.',
  })
  @ApiParam(commentIdParam)
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
      'COMMENT_NOT_FOUND — inexistente, id malformado ou vídeo não publicado',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests — limite de 60 req/min da rota',
  })
  async setReaction(
    @CurrentUser() user: JwtPayload,
    @Param('commentId') commentId: string,
    @Body() dto: SetReactionDto,
  ): Promise<ReactionStateResponse> {
    return this.reactions.set(commentId, user.sub, dto.value);
  }

  @Delete(':commentId/reaction')
  @HttpCode(HttpStatus.OK)
  @Throttle(REACTION_THROTTLE)
  @ApiOperation({
    summary: 'Remove a reação do usuário ao comentário',
    description:
      'Idempotente (social-interactions/TD-03): sem reação, devolve o mesmo estado sem efeito.',
  })
  @ApiParam(commentIdParam)
  @ApiResponse({ status: 200, type: ReactionStateResponse })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado',
  })
  @ApiResponse({
    status: 404,
    description:
      'COMMENT_NOT_FOUND — inexistente, id malformado ou vídeo não publicado',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests — limite de 60 req/min da rota',
  })
  async removeReaction(
    @CurrentUser() user: JwtPayload,
    @Param('commentId') commentId: string,
  ): Promise<ReactionStateResponse> {
    return this.reactions.remove(commentId, user.sub);
  }
}
