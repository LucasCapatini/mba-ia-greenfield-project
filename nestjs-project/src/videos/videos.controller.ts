import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
import { NonEmptyBodyPipe } from '../common/pipes/non-empty-body.pipe';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { PresignPartsDto } from './dto/presign-parts.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import {
  PlaybackResponse,
  PresignedPartsResponse,
  UploadCompletedResponse,
  UploadStateResponse,
  VideoCreatedResponse,
  VideoResponse,
} from './dto/video-response.dto';
import {
  THUMBNAIL_FIELD,
  ThumbnailUploadInterceptor,
} from './thumbnail-upload.interceptor';
import { VideosOwnership } from './videos-ownership';
import { VideosService } from './videos.service';

const errorEnvelope = { $ref: getSchemaPath(ApiErrorEnvelope) };
const publicIdParam = {
  name: 'publicId',
  description: 'Identificador público do vídeo (11 chars base64url)',
  example: 'dQw4w9WgXcQ',
};
// Public reads with optional auth: the header is documented, not required (no @ApiBearerAuth).
const optionalBearerHeader = {
  name: 'Authorization',
  required: false,
  description:
    'Opcional: `Bearer <access_token>`. Sem header → anônimo; token inválido ou expirado → 401.',
};

// Escrita e upload exigem JWT (guard global) e passam pelo VideosOwnership.loadOwned: 404 se não
// existe, 403 se não é o dono. As leituras `GET /:publicId` e `GET /:publicId/playback` são
// @Public() com auth opcional (video-channel-management/TD-07): o dono vê qualquer status, os
// demais só `published`, e um rascunho alheio responde 404 sem revelar que existe.
@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly ownership: VideosOwnership,
  ) {}

  @Post()
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Pré-cadastro do vídeo e abertura do upload multipart',
    description:
      'Cria o rascunho no canal do usuário autenticado, abre a sessão multipart no object storage e devolve os parâmetros para o cliente enviar as partes direto ao storage. Nenhum byte de vídeo passa pela API.',
  })
  @ApiResponse({
    status: 201,
    description: 'Rascunho criado e sessão aberta',
    type: VideoCreatedResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_ERROR ou VIDEO_UNSUPPORTED_MEDIA_TYPE',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 413,
    description: 'VIDEO_TOO_LARGE — size_bytes acima de UPLOAD_MAX_BYTES',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 503,
    description: 'STORAGE_UNAVAILABLE — falha ao abrir o multipart no storage',
    schema: errorEnvelope,
  })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateVideoDto,
  ): Promise<VideoCreatedResponse> {
    return this.videosService.createUpload(user.sub, dto);
  }

  @Public()
  @Get(':publicId')
  @ApiOperation({
    summary: 'Estado e metadados do vídeo',
    description:
      'Leitura pública com autenticação opcional. O dono vê o vídeo em qualquer status (polling de processing_status, metadados do worker, campos editoriais); anônimos e outros usuários só veem vídeos `published` (public ou unlisted). Um rascunho alheio responde 404, sem revelar que existe.',
  })
  @ApiHeader(optionalBearerHeader)
  @ApiParam(publicIdParam)
  @ApiResponse({
    status: 200,
    description: 'Estado atual do vídeo',
    type: VideoResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Token presente mas inválido ou expirado',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND — inexistente ou rascunho de terceiro',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 503,
    description:
      'STORAGE_UNAVAILABLE (mantido do contrato da Fase 03; a thumbnail agora é URL estável)',
    schema: errorEnvelope,
  })
  async getVideo(
    @OptionalUser() user: JwtPayload | undefined,
    @Param('publicId') publicId: string,
  ): Promise<VideoResponse> {
    const video = await this.ownership.loadReadable(user, publicId);
    return this.videosService.getVideo(video);
  }

  @Public()
  @Get(':publicId/playback')
  @ApiOperation({
    summary: 'URLs de reprodução e download',
    description:
      'Leitura pública com autenticação opcional e a mesma regra de visibilidade de `GET /videos/{publicId}`. Emite stream_url (GET pré-assinado; o storage atende Range → 206) e download_url (mesma URL com Content-Disposition: attachment) válidas por PLAYBACK_URL_TTL. Só para vídeos com processing_status = ready.',
  })
  @ApiHeader(optionalBearerHeader)
  @ApiParam(publicIdParam)
  @ApiResponse({
    status: 200,
    description: 'URLs assinadas',
    type: PlaybackResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Token presente mas inválido ou expirado',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND — inexistente ou rascunho de terceiro',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 409,
    description: 'VIDEO_NOT_READY — processing_status ≠ ready',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 503,
    description: 'STORAGE_UNAVAILABLE — falha ao assinar as URLs',
    schema: errorEnvelope,
  })
  async getPlayback(
    @OptionalUser() user: JwtPayload | undefined,
    @Param('publicId') publicId: string,
  ): Promise<PlaybackResponse> {
    const video = await this.ownership.loadReadable(user, publicId);
    return this.videosService.getPlayback(video);
  }

  @Patch(':publicId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Editar os campos editoriais do vídeo',
    description:
      'Edição parcial (só o dono) de title, description, category_id e visibility. Nunca muda status: publicar e despublicar são ações dedicadas. O corpo precisa trazer ao menos um campo; null limpa description/category_id.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({
    status: 200,
    description: 'Vídeo atualizado',
    type: VideoResponse,
  })
  @ApiResponse({
    status: 400,
    description:
      'VALIDATION_ERROR (corpo inválido, vazio ou com campo não editável) ou CATEGORY_NOT_FOUND',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 403,
    description: 'VIDEO_FORBIDDEN — não é o dono',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND',
    schema: errorEnvelope,
  })
  async updateVideo(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
    @Body(NonEmptyBodyPipe) dto: UpdateVideoDto,
  ): Promise<VideoResponse> {
    const video = await this.ownership.loadOwned(user.sub, publicId);
    return this.videosService.updateVideo(video, dto);
  }

  @Post(':publicId/publish')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Publicar o vídeo',
    description:
      'Ação dedicada (só o dono). Exige processing_status = ready e título não vazio; grava published_at só na primeira publicação. Idempotente: já publicado → 200 sem alteração.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({
    status: 200,
    description: 'Vídeo publicado',
    type: VideoResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 403,
    description: 'VIDEO_FORBIDDEN — não é o dono',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 409,
    description:
      'VIDEO_NOT_PUBLISHABLE — processing_status ≠ ready ou título vazio',
    schema: errorEnvelope,
  })
  async publish(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
  ): Promise<VideoResponse> {
    const video = await this.ownership.loadOwned(user.sub, publicId);
    return this.videosService.publish(video);
  }

  @Post(':publicId/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Despublicar o vídeo',
    description:
      'Ação dedicada (só o dono). Volta a draft preservando visibility e published_at. Idempotente: já rascunho → 200.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({
    status: 200,
    description: 'Vídeo de volta a rascunho',
    type: VideoResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 403,
    description: 'VIDEO_FORBIDDEN — não é o dono',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND',
    schema: errorEnvelope,
  })
  async unpublish(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
  ): Promise<VideoResponse> {
    const video = await this.ownership.loadOwned(user.sub, publicId);
    return this.videosService.unpublish(video);
  }

  @Delete(':publicId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Excluir o vídeo',
    description:
      'Só o dono, em qualquer status. Exclusão definitiva: aborta uma sessão multipart ativa, apaga o vídeo e agenda a remoção dos objetos (vídeo e thumbnails) no storage pelo job video.delete.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({ status: 204, description: 'Vídeo excluído' })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 403,
    description: 'VIDEO_FORBIDDEN — não é o dono',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 503,
    description:
      'STORAGE_UNAVAILABLE — falha ao abortar a sessão multipart ativa',
    schema: errorEnvelope,
  })
  async deleteVideo(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
  ): Promise<void> {
    const video = await this.ownership.loadOwned(user.sub, publicId);
    await this.videosService.deleteVideo(video);
  }

  @Put(':publicId/thumbnail')
  @ApiBearerAuth('access-token')
  @UseInterceptors(ThumbnailUploadInterceptor)
  @ApiOperation({
    summary: 'Enviar thumbnail customizada',
    description:
      'Só o dono. multipart/form-data com o campo `file` (image/jpeg, image/png ou image/webp; ≤ THUMBNAIL_MAX_BYTES, 5 MiB por padrão; ≥ 640×360). A imagem é validada pelos bytes e normalizada para JPEG 1280×720; substitui uma customizada anterior e mantém a automática. thumbnail_url passa a apontar para a customizada.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [THUMBNAIL_FIELD],
      properties: { [THUMBNAIL_FIELD]: { type: 'string', format: 'binary' } },
    },
  })
  @ApiParam(publicIdParam)
  @ApiResponse({
    status: 200,
    description: 'Thumbnail customizada aplicada',
    type: VideoResponse,
  })
  @ApiResponse({
    status: 400,
    description:
      'VALIDATION_ERROR (campo file ausente ou multipart inválido) ou THUMBNAIL_INVALID (não é imagem, tipo não suportado ou abaixo de 640×360)',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 403,
    description: 'VIDEO_FORBIDDEN — não é o dono',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 413,
    description: 'THUMBNAIL_TOO_LARGE — acima de THUMBNAIL_MAX_BYTES',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 503,
    description: 'STORAGE_UNAVAILABLE',
    schema: errorEnvelope,
  })
  async setThumbnail(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<VideoResponse> {
    if (!file) {
      throw new BadRequestException([`${THUMBNAIL_FIELD} is required`]);
    }
    const video = await this.ownership.loadOwned(user.sub, publicId);
    return this.videosService.setCustomThumbnail(video, file);
  }

  @Delete(':publicId/thumbnail')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Remover thumbnail customizada',
    description:
      'Só o dono. Remove a customizada (objeto e chave) e volta à thumbnail automática. Idempotente.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({ status: 204, description: 'Thumbnail automática restaurada' })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 403,
    description: 'VIDEO_FORBIDDEN — não é o dono',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 503,
    description: 'STORAGE_UNAVAILABLE',
    schema: errorEnvelope,
  })
  async removeThumbnail(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
  ): Promise<void> {
    const video = await this.ownership.loadOwned(user.sub, publicId);
    await this.videosService.removeCustomThumbnail(video);
  }

  @Post(':publicId/upload/parts')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'URLs pré-assinadas para um lote de partes',
    description:
      'Devolve uma URL de UploadPart por parte solicitada (até 100 por chamada), válida por UPLOAD_URL_TTL. O cliente faz PUT do conteúdo diretamente em cada URL (host S3_PUBLIC_ENDPOINT) e guarda o header ETag da resposta.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({
    status: 200,
    description: 'URLs emitidas',
    type: PresignedPartsResponse,
  })
  @ApiResponse({
    status: 400,
    description:
      'VALIDATION_ERROR — lote inválido ou part_number acima de part_count',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 403,
    description: 'VIDEO_FORBIDDEN — o vídeo pertence a outro canal',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 409,
    description:
      'UPLOAD_NOT_ACTIVE — sessão já concluída, abortada ou expirada',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 503,
    description: 'STORAGE_UNAVAILABLE',
    schema: errorEnvelope,
  })
  async presignParts(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
    @Body() dto: PresignPartsDto,
  ): Promise<PresignedPartsResponse> {
    const video = await this.ownership.loadOwned(user.sub, publicId);
    return this.videosService.presignParts(video, dto.part_numbers);
  }

  @Get(':publicId/upload')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Estado da sessão de upload (retomada)',
    description:
      'Lista as partes já aceitas pelo storage (ListParts) para que o cliente retome o envio após falha ou recarga da página sem reenviar o que já chegou.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({
    status: 200,
    description: 'Sessão ativa com as partes recebidas',
    type: UploadStateResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 403,
    description: 'VIDEO_FORBIDDEN',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 409,
    description: 'UPLOAD_NOT_ACTIVE',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 503,
    description: 'STORAGE_UNAVAILABLE',
    schema: errorEnvelope,
  })
  async getUploadState(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
  ): Promise<UploadStateResponse> {
    const video = await this.ownership.loadOwned(user.sub, publicId);
    return this.videosService.getUploadState(video);
  }

  @Post(':publicId/upload/complete')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Conclui o upload e inicia o processamento',
    description:
      'Confere a lista de partes do cliente contra o storage, fecha o multipart (CompleteMultipartUpload), grava o tamanho real, marca a sessão como concluída e enfileira o processamento. Responde 202: o vídeo fica em processing até o worker terminar.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({
    status: 202,
    description: 'Upload concluído; processamento enfileirado',
    type: UploadCompletedResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_ERROR',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 403,
    description: 'VIDEO_FORBIDDEN',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 409,
    description: 'UPLOAD_NOT_ACTIVE',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 413,
    description: 'VIDEO_TOO_LARGE — soma das partes acima de UPLOAD_MAX_BYTES',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 422,
    description:
      'UPLOAD_INCOMPLETE — parte faltando ou etag divergente do storage',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 503,
    description: 'STORAGE_UNAVAILABLE',
    schema: errorEnvelope,
  })
  async completeUpload(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
    @Body() dto: CompleteUploadDto,
  ): Promise<UploadCompletedResponse> {
    const video = await this.ownership.loadOwned(user.sub, publicId);
    return this.videosService.completeUpload(video, dto.parts);
  }

  @Delete(':publicId/upload')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancela o upload e descarta o rascunho',
    description:
      'Aborta o multipart no storage (as partes já enviadas são descartadas) e remove o rascunho e a sessão. Só é possível enquanto a sessão está ativa.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({
    status: 204,
    description: 'Upload cancelado e rascunho removido',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 403,
    description: 'VIDEO_FORBIDDEN',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description: 'VIDEO_NOT_FOUND',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 409,
    description: 'UPLOAD_NOT_ACTIVE',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 503,
    description: 'STORAGE_UNAVAILABLE',
    schema: errorEnvelope,
  })
  async abortUpload(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
  ): Promise<void> {
    const video = await this.ownership.loadOwned(user.sub, publicId);
    await this.videosService.abortUpload(video);
  }
}
