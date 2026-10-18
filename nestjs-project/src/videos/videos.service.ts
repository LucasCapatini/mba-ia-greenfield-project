import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DataSource, type EntityManager, QueryFailedError } from 'typeorm';
import type { QueueDatabase } from '../queue/queue.service';
import { ChannelsService } from '../channels/channels.service';
import uploadConfig from '../config/upload.config';
import { QUEUE_NAMES, singletonKeys } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import type { CompletedPartDto } from './dto/complete-upload.dto';
import type { CreateVideoDto } from './dto/create-video.dto';
import type {
  PlaybackResponse,
  PresignedPartsResponse,
  UploadCompletedResponse,
  UploadStateResponse,
  VideoCreatedResponse,
  VideoResponse,
} from './dto/video-response.dto';
import { attachmentDisposition } from './content-disposition.util';
import { VideoUpload } from './entities/video-upload.entity';
import { Video } from './entities/video.entity';
import { generatePublicId, storageKeys } from './public-id.util';
import { ALLOWED_VIDEO_MIME_TYPES } from './video-formats';
import {
  UploadIncompleteException,
  UploadNotActiveException,
  UploadPartOutOfRangeException,
  VideoNotReadyException,
  VideoTooLargeException,
  VideoUnsupportedMediaTypeException,
} from './videos.exceptions';

const PG_UNIQUE_VIOLATION = '23505';
const PUBLIC_ID_MAX_ATTEMPTS = 5;
/** Limite de partes do S3 (`### API Contracts → Validation Rules`). */
const S3_MAX_PARTS = 10_000;

function isUniqueViolationOn(err: unknown, column: string): boolean {
  if (!(err instanceof QueryFailedError)) {
    return false;
  }
  const e = err as unknown as { code?: string; detail?: string };
  return (
    e.code === PG_UNIQUE_VIOLATION &&
    typeof e.detail === 'string' &&
    e.detail.includes(column)
  );
}

/**
 * Adapta o EntityManager de uma transação ao `IDatabase` do pg-boss (`executeSql` → `{ rows }`),
 * para que o `send` use a MESMA conexão/transação do domínio (TD-11): o job só existe se o COMMIT
 * acontecer, e vice-versa.
 */
function queueDatabaseFrom(manager: EntityManager): QueueDatabase {
  return {
    executeSql: async (text: string, values?: unknown[]) => ({
      rows: await manager.query(text, values),
    }),
  };
}

// Orquestra o ciclo de vida do upload (phase-03-upload-processing/TD-03, TD-07, TD-08, TD-12, TD-14).
// Nenhum byte de vídeo passa por aqui: só metadados, sessão multipart e jobs.
@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly channelsService: ChannelsService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    @Inject(uploadConfig.KEY)
    private readonly upload: ConfigType<typeof uploadConfig>,
  ) {}

  /**
   * Pré-cadastro: valida a declaração do cliente, cria o rascunho com `public_id` único, abre o
   * multipart no storage, persiste a sessão e agenda `upload.expire` — tudo em uma transação.
   */
  async createUpload(
    userId: string,
    dto: CreateVideoDto,
  ): Promise<VideoCreatedResponse> {
    if (
      !(ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(
        dto.content_type,
      )
    ) {
      throw new VideoUnsupportedMediaTypeException(dto.content_type);
    }
    if (dto.size_bytes > this.upload.maxBytes) {
      throw new VideoTooLargeException(dto.size_bytes, this.upload.maxBytes);
    }
    const partSize = this.upload.partSize;
    const partCount = Math.ceil(dto.size_bytes / partSize);
    if (partCount > S3_MAX_PARTS) {
      throw new VideoTooLargeException(dto.size_bytes, partSize * S3_MAX_PARTS);
    }

    const channel = await this.channelsService.findByUserId(userId);
    if (!channel) {
      // Invariante da Fase 02 (todo usuário tem canal); não é erro de domínio do cliente.
      throw new Error(`User ${userId} has no channel`);
    }

    return this.dataSource.transaction(async (manager) => {
      const video = await this.insertVideoWithUniquePublicId(
        manager,
        channel.id,
        dto,
      );
      const uploadId = await this.storage.createMultipartUpload(
        video.storage_key,
        dto.content_type,
      );
      try {
        const expiresAt = new Date(
          Date.now() + this.upload.sessionTtlSeconds * 1000,
        );
        const session = await manager.save(
          manager.create(VideoUpload, {
            video_id: video.id,
            upload_id: uploadId,
            part_size: partSize,
            part_count: partCount,
            expected_bytes: dto.size_bytes,
            expires_at: expiresAt,
          }),
        );
        await this.queue.send(
          QUEUE_NAMES.UPLOAD_EXPIRE,
          { videoId: video.id },
          {
            singletonKey: singletonKeys.uploadExpire(video.id),
            startAfter: expiresAt,
          },
        );
        this.logger.log(
          `Upload session for video ${video.public_id} expires at ${expiresAt.toISOString()} (UPLOAD_TTL=${this.upload.sessionTtlSeconds}s); upload.expire scheduled`,
        );
        return {
          public_id: video.public_id,
          status: video.status,
          processing_status: video.processing_status,
          upload: {
            upload_id: session.upload_id,
            part_size: session.part_size,
            part_count: session.part_count,
            expires_at: session.expires_at.toISOString(),
          },
        };
      } catch (err) {
        // O multipart já existe no storage; sem o abort ele ficaria órfão até o lifecycle.
        await this.storage
          .abortMultipartUpload(video.storage_key, uploadId)
          .catch((abortErr: unknown) =>
            this.logger.error(
              `Failed to abort orphan multipart ${uploadId} for ${video.storage_key}: ${String(abortErr)}`,
            ),
          );
        throw err;
      }
    });
  }

  /** URLs pré-assinadas de `UploadPart` para um lote de partes (sessão precisa estar `active`). */
  async presignParts(
    video: Video,
    partNumbers: number[],
  ): Promise<PresignedPartsResponse> {
    const session = this.activeSession(video);
    const outOfRange = partNumbers.filter((n) => n > session.part_count);
    if (outOfRange.length > 0) {
      throw new UploadPartOutOfRangeException(outOfRange, session.part_count);
    }
    const ttl = this.upload.urlTtlSeconds;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const parts = await Promise.all(
      partNumbers.map(async (partNumber) => ({
        part_number: partNumber,
        url: await this.storage.presignUploadPart(
          video.storage_key,
          session.upload_id,
          partNumber,
          ttl,
        ),
      })),
    );
    return {
      upload_id: session.upload_id,
      part_size: session.part_size,
      expires_at: expiresAt.toISOString(),
      parts,
    };
  }

  /** Estado da sessão para retomada: partes já aceitas pelo storage (`ListParts`). */
  async getUploadState(video: Video): Promise<UploadStateResponse> {
    const session = this.activeSession(video);
    const uploaded = await this.storage.listParts(
      video.storage_key,
      session.upload_id,
    );
    if (uploaded === null) {
      // A sessão está ativa no banco mas sumiu do storage (lifecycle/abort externo).
      throw new UploadIncompleteException(
        'multipart upload no longer exists in storage',
      );
    }
    return {
      upload_id: session.upload_id,
      state: session.state,
      part_size: session.part_size,
      part_count: session.part_count,
      expected_bytes: session.expected_bytes,
      expires_at: session.expires_at.toISOString(),
      uploaded_parts: uploaded.map((part) => ({
        part_number: part.partNumber,
        etag: part.etag,
        size: part.size,
      })),
    };
  }

  /**
   * Fecha o multipart e dispara o processamento: a lista do cliente é conferida contra o storage,
   * o objeto é montado e, em uma transação, a sessão vira `completed`, o vídeo vai para
   * `processing` e `video.process` é enfileirado pela mesma conexão (TD-11).
   */
  async completeUpload(
    video: Video,
    parts: CompletedPartDto[],
  ): Promise<UploadCompletedResponse> {
    const session = this.activeSession(video);
    if (parts.length !== session.part_count) {
      throw new UploadIncompleteException(
        `expected ${session.part_count} parts, received ${parts.length}`,
      );
    }
    const uploaded = await this.storage.listParts(
      video.storage_key,
      session.upload_id,
    );
    if (uploaded === null) {
      throw new UploadIncompleteException(
        'multipart upload no longer exists in storage',
      );
    }
    const byNumber = new Map(uploaded.map((part) => [part.partNumber, part]));
    for (const part of parts) {
      const stored = byNumber.get(part.part_number);
      if (!stored) {
        throw new UploadIncompleteException(
          `part ${part.part_number} was not received by the storage`,
        );
      }
      if (stored.etag !== part.etag) {
        throw new UploadIncompleteException(
          `etag mismatch for part ${part.part_number}`,
        );
      }
    }
    const sizeBytes = parts.reduce(
      (sum, part) => sum + byNumber.get(part.part_number)!.size,
      0,
    );
    if (sizeBytes > this.upload.maxBytes) {
      throw new VideoTooLargeException(sizeBytes, this.upload.maxBytes);
    }

    const ordered = [...parts]
      .sort((a, b) => a.part_number - b.part_number)
      .map((part) => ({ partNumber: part.part_number, etag: part.etag }));
    await this.storage.completeMultipartUpload(
      video.storage_key,
      session.upload_id,
      ordered,
    );

    return this.dataSource.transaction(async (manager) => {
      await manager.update(
        VideoUpload,
        { id: session.id },
        { state: 'completed', completed_at: new Date() },
      );
      // Transição guardada (TD-10): só sai de `uploading`; um complete repetido não regride o estado.
      await manager.query(
        `UPDATE videos SET size_bytes = $2, processing_status = 'processing', updated_at = now()
         WHERE id = $1 AND processing_status = 'uploading'`,
        [video.id, sizeBytes],
      );
      await this.queue.send(
        QUEUE_NAMES.VIDEO_PROCESS,
        { videoId: video.id },
        {
          singletonKey: singletonKeys.videoProcess(video.id),
          db: queueDatabaseFrom(manager),
        },
      );
      return {
        public_id: video.public_id,
        status: video.status,
        processing_status: 'processing',
        size_bytes: sizeBytes,
      };
    });
  }

  /** Desiste do upload: aborta o multipart no storage e remove o rascunho (a sessão cai em cascata). */
  async abortUpload(video: Video): Promise<void> {
    const session = this.activeSession(video);
    await this.storage.abortMultipartUpload(
      video.storage_key,
      session.upload_id,
    );
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        VideoUpload,
        { id: session.id },
        { state: 'aborted' },
      );
      await manager.delete(Video, { id: video.id });
    });
  }

  /** Estado e metadados para o dono acompanhar o processamento (polling) — TD-06/TD-07/TD-11. */
  async getVideo(video: Video): Promise<VideoResponse> {
    return {
      public_id: video.public_id,
      status: video.status,
      processing_status: video.processing_status,
      processing_error: video.processing_error,
      original_filename: video.original_filename,
      content_type: video.content_type,
      size_bytes: video.size_bytes,
      duration_seconds: video.duration_seconds,
      width: video.width,
      height: video.height,
      container: video.container,
      video_codec: video.video_codec,
      audio_codec: video.audio_codec,
      thumbnail_url: await this.presignThumbnail(video),
      created_at: video.created_at.toISOString(),
      processed_at: video.processed_at
        ? video.processed_at.toISOString()
        : null,
    };
  }

  /**
   * URLs GET pré-assinadas com o cliente público (TD-09): o storage atende `Range` e devolve o
   * `Content-Disposition` pedido na assinatura; nenhum byte passa pela API.
   */
  async getPlayback(video: Video): Promise<PlaybackResponse> {
    if (video.processing_status !== 'ready') {
      throw new VideoNotReadyException(video.processing_status);
    }
    const ttl = this.upload.playbackUrlTtlSeconds;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const [streamUrl, downloadUrl, thumbnailUrl] = await Promise.all([
      this.storage.presignGetObject(video.storage_key, ttl, { public: true }),
      this.storage.presignGetObject(video.storage_key, ttl, {
        public: true,
        responseContentDisposition: attachmentDisposition(
          video.original_filename,
          video.content_type,
        ),
      }),
      this.presignThumbnail(video),
    ]);
    return {
      stream_url: streamUrl,
      download_url: downloadUrl,
      thumbnail_url: thumbnailUrl,
      expires_at: expiresAt.toISOString(),
    };
  }

  private async presignThumbnail(video: Video): Promise<string | null> {
    if (!video.thumbnail_key) {
      return null;
    }
    return this.storage.presignGetObject(
      video.thumbnail_key,
      this.upload.playbackUrlTtlSeconds,
      { public: true },
    );
  }

  private activeSession(video: Video): VideoUpload {
    const session = video.upload;
    if (!session) {
      throw new UploadNotActiveException('missing');
    }
    if (session.state !== 'active') {
      throw new UploadNotActiveException(session.state);
    }
    return session;
  }

  /** Insere o rascunho; em colisão de `public_id` (unique) refaz só a tentativa via SAVEPOINT (TD-08). */
  private async insertVideoWithUniquePublicId(
    manager: EntityManager,
    channelId: string,
    dto: CreateVideoDto,
  ): Promise<Video> {
    for (let attempt = 0; attempt < PUBLIC_ID_MAX_ATTEMPTS; attempt++) {
      const publicId = generatePublicId();
      await manager.query(`SAVEPOINT public_id_${attempt}`);
      try {
        const video = await manager.save(
          manager.create(Video, {
            public_id: publicId,
            channel_id: channelId,
            original_filename: dto.original_filename,
            content_type: dto.content_type,
            size_bytes: dto.size_bytes,
            storage_key: storageKeys(publicId).source,
          }),
        );
        await manager.query(`RELEASE SAVEPOINT public_id_${attempt}`);
        return video;
      } catch (err) {
        await manager.query(`ROLLBACK TO SAVEPOINT public_id_${attempt}`);
        if (
          !isUniqueViolationOn(err, 'public_id') ||
          attempt === PUBLIC_ID_MAX_ATTEMPTS - 1
        ) {
          throw err;
        }
        this.logger.warn(
          `public_id collision on attempt ${attempt + 1}; retrying`,
        );
      }
    }
    throw new Error('unreachable: public_id retry loop exhausted');
  }
}
