import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { PresignPartsDto } from './dto/presign-parts.dto';
import {
  PlaybackResponse,
  PresignedPartsResponse,
  UploadCompletedResponse,
  UploadStateResponse,
  VideoCreatedResponse,
  VideoResponse,
} from './dto/video-response.dto';
import { VideosOwnership } from './videos-ownership';
import { VideosService } from './videos.service';

const errorEnvelope = { $ref: getSchemaPath(ApiErrorEnvelope) };
const publicIdParam = {
  name: 'publicId',
  description: 'Identificador público do vídeo (11 chars base64url)',
  example: 'dQw4w9WgXcQ',
};

// Todas as rotas exigem JWT (guard global) — nenhuma é @Public() nesta fase (Authorization Matrix).
// As rotas `/:publicId/upload*` passam pelo VideosOwnership: 404 se não existe, 403 se não é o dono.
@ApiTags('videos')
@ApiBearerAuth('access-token')
@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly ownership: VideosOwnership,
  ) {}

  @Post()
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

  @Get(':publicId')
  @ApiOperation({
    summary: 'Estado e metadados do vídeo',
    description:
      'Para o dono acompanhar o processamento (polling de processing_status) e ler os metadados extraídos pelo worker. thumbnail_url é uma URL GET pré-assinada quando a thumbnail existe.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({
    status: 200,
    description: 'Estado atual do vídeo',
    type: VideoResponse,
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
    status: 503,
    description: 'STORAGE_UNAVAILABLE — falha ao assinar a thumbnail',
    schema: errorEnvelope,
  })
  async getVideo(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
  ): Promise<VideoResponse> {
    const video = await this.ownership.loadOwned(user.sub, publicId);
    return this.videosService.getVideo(video);
  }

  @Get(':publicId/playback')
  @ApiOperation({
    summary: 'URLs de reprodução e download',
    description:
      'Emite stream_url (GET pré-assinado; o storage atende Range → 206) e download_url (mesma URL com Content-Disposition: attachment) válidas por PLAYBACK_URL_TTL. Só para vídeos com processing_status = ready.',
  })
  @ApiParam(publicIdParam)
  @ApiResponse({
    status: 200,
    description: 'URLs assinadas',
    type: PlaybackResponse,
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
    description: 'VIDEO_NOT_READY — processing_status ≠ ready',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 503,
    description: 'STORAGE_UNAVAILABLE — falha ao assinar as URLs',
    schema: errorEnvelope,
  })
  async getPlayback(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
  ): Promise<PlaybackResponse> {
    const video = await this.ownership.loadOwned(user.sub, publicId);
    return this.videosService.getPlayback(video);
  }

  @Post(':publicId/upload/parts')
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
