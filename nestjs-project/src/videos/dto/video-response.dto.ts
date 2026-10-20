import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponse } from '../../categories/dto/category-response.dto';
import {
  REACTION_VALUES,
  type ReactionValue,
} from '../../reactions/reactions.constants';
import { VIDEO_CONTAINERS, type VideoContainer } from '../video-formats';
import {
  VIDEO_PROCESSING_ERRORS,
  VIDEO_PROCESSING_STATUSES,
  VIDEO_STATUSES,
  VIDEO_UPLOAD_STATES,
  VIDEO_VISIBILITIES,
  type VideoProcessingError,
  type VideoProcessingStatus,
  type VideoStatus,
  type VideoUploadState,
  type VideoVisibility,
} from '../videos.constants';

// Shapes de resposta da API de vídeos (`### API Contracts`). Anotados para o Swagger porque o
// openapi.json é a fonte dos tipos do frontend (openapi-docs-nestjs/TD-01).

export class UploadSessionResponse {
  @ApiProperty({ description: 'UploadId do multipart no storage.' })
  upload_id: string;

  @ApiProperty({
    type: 'integer',
    description: 'Bytes por parte.',
    example: 67108864,
  })
  part_size: number;

  @ApiProperty({
    type: 'integer',
    description: 'Número total de partes = ceil(size_bytes / part_size).',
    example: 3,
  })
  part_count: number;

  @ApiProperty({
    description:
      'Prazo da sessão (ISO-8601); depois dele o rascunho é descartado.',
    example: '2026-10-19T19:00:00.000Z',
  })
  expires_at: string;
}

export class VideoCreatedResponse {
  @ApiProperty({
    description: 'Identificador público (11 chars) usado na URL.',
    example: 'dQw4w9WgXcQ',
  })
  public_id: string;

  @ApiProperty({ enum: VIDEO_STATUSES, example: 'draft' })
  status: VideoStatus;

  @ApiProperty({ enum: VIDEO_PROCESSING_STATUSES, example: 'uploading' })
  processing_status: VideoProcessingStatus;

  @ApiProperty({ type: UploadSessionResponse })
  upload: UploadSessionResponse;
}

export class PresignedPartResponse {
  @ApiProperty({ type: 'integer', example: 1 })
  part_number: number;

  @ApiProperty({
    description:
      'URL pré-assinada para `PUT` direto no storage (host S3_PUBLIC_ENDPOINT).',
  })
  url: string;
}

export class PresignedPartsResponse {
  @ApiProperty()
  upload_id: string;

  @ApiProperty({ type: 'integer' })
  part_size: number;

  @ApiProperty({ description: 'Validade das URLs deste lote (ISO-8601).' })
  expires_at: string;

  @ApiProperty({ type: [PresignedPartResponse] })
  parts: PresignedPartResponse[];
}

export class UploadedPartResponse {
  @ApiProperty({ type: 'integer' })
  part_number: number;

  @ApiProperty({ description: 'ETag aceito pelo storage (com aspas).' })
  etag: string;

  @ApiProperty({ type: 'integer', description: 'Bytes da parte.' })
  size: number;
}

export class UploadStateResponse {
  @ApiProperty()
  upload_id: string;

  @ApiProperty({ enum: VIDEO_UPLOAD_STATES, example: 'active' })
  state: VideoUploadState;

  @ApiProperty({ type: 'integer' })
  part_size: number;

  @ApiProperty({ type: 'integer' })
  part_count: number;

  @ApiProperty({ type: 'integer' })
  expected_bytes: number;

  @ApiProperty({ description: 'Prazo da sessão (ISO-8601).' })
  expires_at: string;

  @ApiProperty({
    type: [UploadedPartResponse],
    description: 'Partes já aceitas pelo storage (ListParts).',
  })
  uploaded_parts: UploadedPartResponse[];
}

export class UploadCompletedResponse {
  @ApiProperty({ example: 'dQw4w9WgXcQ' })
  public_id: string;

  @ApiProperty({ enum: VIDEO_STATUSES, example: 'draft' })
  status: VideoStatus;

  @ApiProperty({ enum: VIDEO_PROCESSING_STATUSES, example: 'processing' })
  processing_status: VideoProcessingStatus;

  @ApiProperty({
    type: 'integer',
    description: 'Tamanho confirmado pela soma das partes.',
  })
  size_bytes: number;
}

/**
 * Dados públicos do canal dono do vídeo — nas listagens (`VideoCardItem`) e, desde a Fase 05, no
 * `VideoResponse` (resolução OQ-1). Declarado antes dos dois: `emitDecoratorMetadata` referencia a
 * classe na definição das propriedades.
 */
export class VideoCardChannel {
  @ApiProperty({ example: 'tech_mastery' })
  nickname: string;

  @ApiProperty({ example: 'Tech Mastery Plus' })
  name: string;
}

/**
 * Canal embutido no `VideoResponse` (social-interactions/TD-04): os dados públicos do card mais a
 * contagem de inscritos e se o solicitante segue o canal. As listagens continuam com
 * `VideoCardChannel`.
 */
export class VideoChannel extends VideoCardChannel {
  @ApiProperty({ type: 'integer', example: 1200 })
  subscriber_count: number;

  @ApiProperty({
    description: 'Se o solicitante segue o canal; anônimo → false.',
  })
  viewer_subscribed: boolean;
}

export class VideoResponse {
  @ApiProperty({ example: 'dQw4w9WgXcQ' })
  public_id: string;

  @ApiProperty({ enum: VIDEO_STATUSES, example: 'draft' })
  status: VideoStatus;

  @ApiProperty({
    enum: VIDEO_VISIBILITIES,
    example: 'public',
    description: 'Só tem efeito quando `status = published`.',
  })
  visibility: VideoVisibility;

  @ApiProperty({ enum: VIDEO_PROCESSING_STATUSES })
  processing_status: VideoProcessingStatus;

  @ApiProperty({
    enum: VIDEO_PROCESSING_ERRORS,
    nullable: true,
    description: 'Código quando `failed`.',
  })
  processing_error: VideoProcessingError | null;

  @ApiProperty({
    maxLength: 100,
    description:
      'Nasce como `original_filename` sem extensão; publicar exige não vazio.',
    example: 'Minha aula.final',
  })
  title: string;

  @ApiProperty({ type: String, nullable: true, maxLength: 5000 })
  description: string | null;

  @ApiProperty({ type: CategoryResponse, nullable: true })
  category: CategoryResponse | null;

  @ApiProperty()
  original_filename: string;

  @ApiProperty({ example: 'video/mp4' })
  content_type: string;

  @ApiProperty({ type: 'integer', nullable: true })
  size_bytes: number | null;

  @ApiProperty({ type: 'number', nullable: true, example: 12.345 })
  duration_seconds: number | null;

  @ApiProperty({ type: 'integer', nullable: true })
  width: number | null;

  @ApiProperty({ type: 'integer', nullable: true })
  height: number | null;

  @ApiProperty({ enum: VIDEO_CONTAINERS, nullable: true })
  container: VideoContainer | null;

  @ApiProperty({ nullable: true, example: 'h264' })
  video_codec: string | null;

  @ApiProperty({ nullable: true, example: 'aac' })
  audio_codec: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'URL pública e estável da thumbnail (customizada ou automática), sem assinatura, com `?v=` para cache-busting (TD-10); null enquanto não existe.',
  })
  thumbnail_url: string | null;

  @ApiProperty({
    description:
      'Verdadeiro quando o dono enviou uma thumbnail customizada (substitui a automática).',
  })
  has_custom_thumbnail: boolean;

  @ApiProperty({ type: 'integer', example: 0 })
  view_count: number;

  @ApiProperty({ type: 'integer', example: 0 })
  like_count: number;

  @ApiProperty({ type: 'integer', example: 0 })
  dislike_count: number;

  @ApiProperty({ type: 'integer', example: 0 })
  comment_count: number;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'ISO-8601 da primeira publicação; não é anulado ao despublicar.',
  })
  published_at: string | null;

  @ApiProperty({ description: 'ISO-8601' })
  created_at: string;

  @ApiProperty({ nullable: true, description: 'ISO-8601' })
  processed_at: string | null;

  @ApiProperty({
    enum: REACTION_VALUES,
    nullable: true,
    description:
      'Reação do solicitante ao vídeo (social-interactions/TD-04); anônimo → null.',
  })
  viewer_reaction: ReactionValue | null;

  @ApiProperty({
    type: VideoChannel,
    description:
      'Canal dono do vídeo — a watch page o exibe sob o título (Fase 05) com a contagem de inscritos e o estado do botão Subscribe (Fase 06).',
  })
  channel: VideoChannel;
}

/** Linha do painel do dono (`GET /channels/me/videos`). */
export class VideoListItem {
  @ApiProperty({ example: 'dQw4w9WgXcQ' })
  public_id: string;

  @ApiProperty({ example: 'Minha aula.final' })
  title: string;

  @ApiProperty({ enum: VIDEO_STATUSES })
  status: VideoStatus;

  @ApiProperty({ enum: VIDEO_VISIBILITIES })
  visibility: VideoVisibility;

  @ApiProperty({ enum: VIDEO_PROCESSING_STATUSES })
  processing_status: VideoProcessingStatus;

  @ApiProperty({ enum: VIDEO_PROCESSING_ERRORS, nullable: true })
  processing_error: VideoProcessingError | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'URL pública e estável da thumbnail (customizada ou automática), sem assinatura, com `?v=` para cache-busting (TD-10); null enquanto não existe.',
  })
  thumbnail_url: string | null;

  @ApiProperty({ type: 'number', nullable: true })
  duration_seconds: number | null;

  @ApiProperty({ type: 'integer' })
  view_count: number;

  @ApiProperty({ type: 'integer' })
  like_count: number;

  @ApiProperty({ type: 'integer' })
  comment_count: number;

  @ApiProperty({ type: String, nullable: true, description: 'ISO-8601' })
  published_at: string | null;

  @ApiProperty({ description: 'ISO-8601' })
  created_at: string;
}

/** Card das listagens públicas (`GET /channels/{nickname}/videos`, Fases 05/07). */
export class VideoCardItem {
  @ApiProperty({ example: 'dQw4w9WgXcQ' })
  public_id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'URL pública e estável da thumbnail (customizada ou automática), sem assinatura, com `?v=` para cache-busting (TD-10); null enquanto não existe.',
  })
  thumbnail_url: string | null;

  @ApiProperty({ type: 'number', nullable: true })
  duration_seconds: number | null;

  @ApiProperty({ type: 'integer' })
  view_count: number;

  @ApiProperty({ type: String, nullable: true, description: 'ISO-8601' })
  published_at: string | null;

  @ApiProperty({ type: VideoCardChannel })
  channel: VideoCardChannel;
}

export class PlaybackResponse {
  @ApiProperty({
    description: 'GET pré-assinado do vídeo; o storage atende `Range` (206).',
  })
  stream_url: string;

  @ApiProperty({
    description:
      'GET pré-assinado com `Content-Disposition: attachment; filename="…"`.',
  })
  download_url: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'URL pública e estável da thumbnail (customizada ou automática), sem assinatura, com `?v=` para cache-busting (TD-10); null enquanto não existe.',
  })
  thumbnail_url: string | null;

  @ApiProperty({
    description: 'Validade das URLs (ISO-8601), now + PLAYBACK_URL_TTL.',
  })
  expires_at: string;
}
