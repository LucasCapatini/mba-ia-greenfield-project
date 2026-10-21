import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { Throttle } from '@nestjs/throttler';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalUser } from '../auth/decorators/optional-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ApiErrorEnvelope } from '../common/openapi/api-error-envelope.dto';
import { READ_THROTTLE } from '../common/throttling/read-throttle';
import { CommentsService } from './comments.service';
import { CommentResponse, CommentsPage } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentsQuery } from './dto/list-comments.dto';

const errorEnvelope = { $ref: getSchemaPath(ApiErrorEnvelope) };
const publicIdParam = {
  name: 'publicId',
  description: 'Identificador público do vídeo (11 caracteres)',
  example: 'dQw4w9WgXcQ',
};

// Comentários como sub-recurso do vídeo (social-interactions/TD-06, TD-07). A listagem é pública
// com token opcional (preenche viewer_reaction/viewer_is_author); criar exige JWT (guard global).
// Vídeo não `published` → 404 VIDEO_NOT_FOUND, inclusive para o dono (TD-03, Revisions 2026-10-20).
@ApiTags('videos')
@Controller('videos')
export class VideoCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Public()
  @Get(':publicId/comments')
  @Throttle(READ_THROTTLE)
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests — limite de 60 req/min por visitante',
  })
  @ApiOperation({
    summary: 'Comentários raiz do vídeo',
    description:
      'Raízes paginadas em cursor keyset: `sort=latest` (padrão, mais recentes primeiro) ou `top` (mais curtidos). As respostas vêm por `GET /comments/{commentId}/replies`. Com token, cada item traz a reação do solicitante e se ele é o autor.',
  })
  @ApiHeader({
    name: 'Authorization',
    required: false,
    description:
      'Opcional: `Bearer <access_token>`. Sem header → anônimo; token inválido ou expirado → 401.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({ status: 200, type: CommentsPage })
  @ApiResponse({
    status: 400,
    description:
      'VALIDATION_ERROR — `sort`/`limit` inválidos ou `cursor` malformado/de outra ordenação',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 401,
    description: 'Token presente mas inválido ou expirado',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND — inexistente ou não publicado',
    schema: errorEnvelope,
  })
  async list(
    @OptionalUser() user: JwtPayload | undefined,
    @Param('publicId') publicId: string,
    @Query() query: ListCommentsQuery,
  ): Promise<CommentsPage> {
    return this.comments.listRoots(publicId, query, user?.sub);
  }

  @Post(':publicId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Comenta no vídeo',
    description:
      'Cria um comentário raiz. Texto puro, 1 a 2.000 caracteres após remover os espaços das pontas; quebras de linha preservadas. Soma 1 ao `comment_count` do vídeo.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({ status: 201, type: CommentResponse })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_ERROR — `text` ausente, vazio ou longo demais',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado',
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND — inexistente ou não publicado',
    schema: errorEnvelope,
  })
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponse> {
    return this.comments.create(publicId, user.sub, dto.text);
  }
}
