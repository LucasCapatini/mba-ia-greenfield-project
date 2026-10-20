import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalUser } from '../auth/decorators/optional-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ApiErrorEnvelope } from '../common/openapi/api-error-envelope.dto';
import { CommentsService } from './comments.service';
import { CommentResponse, CommentsPage } from './dto/comment-response.dto';
import { CreateCommentDto, UpdateCommentDto } from './dto/create-comment.dto';
import { ListRepliesQuery } from './dto/list-comments.dto';

const errorEnvelope = { $ref: getSchemaPath(ApiErrorEnvelope) };
const commentIdParam = {
  name: 'commentId',
  description: 'Id (uuid) do comentário; malformado → 404',
  format: 'uuid',
};

// Comentário como recurso próprio (social-interactions/TD-05..TD-07): só o autor edita ou exclui
// (403 COMMENT_FORBIDDEN para os demais); inexistente, id malformado ou vídeo não publicado → 404.
// As respostas são sub-recurso da raiz: listar é público com token opcional, responder exige JWT.
@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Public()
  @Get(':commentId/replies')
  @ApiOperation({
    summary: 'Respostas de um comentário raiz',
    description:
      'Respostas da raiz da mais antiga para a mais nova, em cursor keyset. Com token, cada item traz a reação do solicitante e se ele é o autor. Um comentário que já é resposta não tem respostas (404).',
  })
  @ApiHeader({
    name: 'Authorization',
    required: false,
    description:
      'Opcional: `Bearer <access_token>`. Sem header → anônimo; token inválido ou expirado → 401.',
  })
  @ApiParam(commentIdParam)
  @ApiResponse({ status: 200, type: CommentsPage })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_ERROR — `limit` inválido ou `cursor` malformado',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 401,
    description: 'Token presente mas inválido ou expirado',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description:
      'COMMENT_NOT_FOUND — inexistente, não é raiz ou vídeo não publicado',
    schema: errorEnvelope,
  })
  async listReplies(
    @OptionalUser() user: JwtPayload | undefined,
    @Param('commentId') commentId: string,
    @Query() query: ListRepliesQuery,
  ): Promise<CommentsPage> {
    return this.comments.listReplies(commentId, query, user?.sub);
  }

  @Post(':commentId/replies')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Responde a um comentário',
    description:
      'Cria uma resposta (um nível só): se `commentId` já é uma resposta, a nova é gravada na raiz dela. Soma 1 ao `reply_count` da raiz e ao `comment_count` do vídeo.',
  })
  @ApiParam(commentIdParam)
  @ApiResponse({ status: 201, type: CommentResponse })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_ERROR — `text` inválido',
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
  async reply(
    @CurrentUser() user: JwtPayload,
    @Param('commentId') commentId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponse> {
    return this.comments.reply(commentId, user.sub, dto.text);
  }

  @Patch(':commentId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Edita o próprio comentário',
    description:
      'Troca o texto (mesmas regras da criação) e grava `edited_at`. Vale para raízes e respostas.',
  })
  @ApiParam(commentIdParam)
  @ApiResponse({ status: 200, type: CommentResponse })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_ERROR — `text` inválido',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado',
  })
  @ApiResponse({
    status: 403,
    description: 'COMMENT_FORBIDDEN — o solicitante não é o autor',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description:
      'COMMENT_NOT_FOUND — inexistente, id malformado ou vídeo não publicado',
    schema: errorEnvelope,
  })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentResponse> {
    return this.comments.update(commentId, user.sub, dto.text);
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Exclui o próprio comentário',
    description:
      'Exclusão física. Apagar uma raiz apaga as respostas e desconta `1 + reply_count` do `comment_count` do vídeo; apagar uma resposta desconta 1 do vídeo e da raiz.',
  })
  @ApiParam(commentIdParam)
  @ApiResponse({ status: 204, description: 'Comentário excluído' })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado',
  })
  @ApiResponse({
    status: 403,
    description: 'COMMENT_FORBIDDEN — o solicitante não é o autor',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description:
      'COMMENT_NOT_FOUND — inexistente, id malformado ou vídeo não publicado',
    schema: errorEnvelope,
  })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    await this.comments.remove(commentId, user.sub);
  }
}
