import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  DataSource,
  type EntityManager,
  QueryFailedError,
  type Repository,
} from 'typeorm';
import type { QueueDatabase } from '../queue/queue.service';
import { CategoriesService } from '../categories/categories.service';
import type { Category } from '../categories/entities/category.entity';
import {
  type CategoryResponse,
  toCategoryResponse,
} from '../categories/dto/category-response.dto';
import { ChannelsService } from '../channels/channels.service';
import uploadConfig from '../config/upload.config';
import {
  QUEUE_NAMES,
  singletonKeys,
  type VideoDeletePayload,
} from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import type { CompletedPartDto } from './dto/complete-upload.dto';
import type { CreateVideoDto } from './dto/create-video.dto';
import type { UpdateVideoDto } from './dto/update-video.dto';
import type {
  PlaybackResponse,
  PresignedPartsResponse,
  UploadCompletedResponse,
  UploadStateResponse,
  VideoCardChannel,
  VideoCreatedResponse,
  VideoResponse,
} from './dto/video-response.dto';
import { attachmentDisposition } from './content-disposition.util';
import { VideoUpload } from './entities/video-upload.entity';
import { Video } from './entities/video.entity';
import { generatePublicId, storageKeys } from './public-id.util';
import { ThumbnailProcessor } from './thumbnail.processor';
import { deriveVideoTitle } from './video-title.util';
import { ALLOWED_VIDEO_MIME_TYPES } from './video-formats';
import {
  CategoryNotFoundException,
  UploadIncompleteException,
  UploadNotActiveException,
  UploadPartOutOfRangeException,
  VideoNotPublishableException,
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
    private readonly categoriesService: CategoriesService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly thumbnailProcessor: ThumbnailProcessor,
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
  /**
   * Exclusão definitiva (video-channel-management/TD-09). Uma sessão multipart `active` é abortada
   * no storage antes (falha → 503, nada muda no banco). Depois, numa transação, a linha é apagada
   * (a `VideoUpload` cai em cascata) e o job `video.delete` é enfileirado na MESMA conexão: o job
   * só existe se o DELETE confirmar (TD-11 da Fase 03). Os objetos saem pelo worker.
   */
  async deleteVideo(video: Video): Promise<void> {
    const session = video.upload;
    if (session?.state === 'active') {
      await this.storage.abortMultipartUpload(
        video.storage_key,
        session.upload_id,
      );
    }
    const payload: VideoDeletePayload = {
      videoId: video.id,
      publicId: video.public_id,
      storageKey: video.storage_key,
      thumbnailKeys: [video.thumbnail_key, video.custom_thumbnail_key].filter(
        (key): key is string => Boolean(key),
      ),
    };
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Video, { id: video.id });
      await this.queue.send(QUEUE_NAMES.VIDEO_DELETE, payload, {
        singletonKey: singletonKeys.videoDelete(video.id),
        db: queueDatabaseFrom(manager),
      });
    });
  }

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

  /**
   * Estado, metadados e campos editoriais do vídeo (Fase 03 TD-06/TD-07/TD-11; Fase 04 TD-02,
   * TD-04, TD-05). A categoria vem da relação carregada (`VideosOwnership.loadOwned`); se o
   * chamador não a carregou, é buscada pelo `category_id`.
   */
  async getVideo(video: Video): Promise<VideoResponse> {
    return {
      public_id: video.public_id,
      status: video.status,
      visibility: video.visibility,
      processing_status: video.processing_status,
      processing_error: video.processing_error,
      title: video.title,
      description: video.description,
      category: await this.resolveCategory(video),
      original_filename: video.original_filename,
      content_type: video.content_type,
      size_bytes: video.size_bytes,
      duration_seconds: video.duration_seconds,
      width: video.width,
      height: video.height,
      container: video.container,
      video_codec: video.video_codec,
      audio_codec: video.audio_codec,
      thumbnail_url: this.thumbnailUrl(video),
      has_custom_thumbnail: video.custom_thumbnail_key !== null,
      view_count: video.view_count,
      like_count: video.like_count,
      dislike_count: video.dislike_count,
      comment_count: video.comment_count,
      published_at: video.published_at
        ? video.published_at.toISOString()
        : null,
      created_at: video.created_at.toISOString(),
      processed_at: video.processed_at
        ? video.processed_at.toISOString()
        : null,
      channel: await this.resolveChannel(video),
    };
  }

  /**
   * Edição parcial dos campos editoriais (TD-03): só os campos presentes no DTO mudam e `status`
   * nunca é tocado. `category_id` precisa existir (400 `CATEGORY_NOT_FOUND`); `null` remove.
   */
  async updateVideo(video: Video, dto: UpdateVideoDto): Promise<VideoResponse> {
    const changes: Partial<
      Pick<Video, 'title' | 'description' | 'category_id' | 'visibility'>
    > = {};
    if (dto.title !== undefined) changes.title = dto.title;
    if (dto.description !== undefined) changes.description = dto.description;
    if (dto.visibility !== undefined) changes.visibility = dto.visibility;

    let category: Category | null | undefined;
    if (dto.category_id !== undefined) {
      category =
        dto.category_id === null
          ? null
          : await this.categoriesService.findById(dto.category_id);
      if (dto.category_id !== null && !category) {
        throw new CategoryNotFoundException(dto.category_id);
      }
      changes.category_id = dto.category_id;
    }

    await this.applyChanges(video, changes);
    if (category !== undefined) {
      video.category = category;
    }
    return this.getVideo(video);
  }

  /**
   * Ação dedicada de publicação (TD-02/TD-03). Exige `processing_status = ready` e título não
   * vazio; grava `published_at` só na primeira vez. Já publicado → devolve sem alterar.
   */
  async publish(video: Video): Promise<VideoResponse> {
    if (video.status === 'published') {
      return this.getVideo(video);
    }
    if (video.processing_status !== 'ready') {
      throw new VideoNotPublishableException(
        `processing_status is ${video.processing_status}`,
      );
    }
    if (video.title.trim().length === 0) {
      throw new VideoNotPublishableException('title is empty');
    }
    const changes: Pick<Video, 'status' | 'published_at'> = {
      status: 'published',
      published_at: video.published_at ?? new Date(),
    };
    await this.applyChanges(video, changes);
    return this.getVideo(video);
  }

  /**
   * Volta a rascunho preservando `visibility` e `published_at` (TD-02). Já rascunho → devolve
   * sem alterar.
   */
  async unpublish(video: Video): Promise<VideoResponse> {
    if (video.status !== 'draft') {
      await this.applyChanges(video, { status: 'draft' });
    }
    return this.getVideo(video);
  }

  /**
   * Thumbnail customizada (TD-04): valida e normaliza para JPEG 1280×720, grava em
   * `thumbnails/{public_id}/custom.jpg` (sobrescrevendo uma anterior) e aponta
   * `custom_thumbnail_key` para ela. A automática do worker fica intacta. O objeto é gravado
   * antes do banco: se a escrita no banco falhar, sobra só um objeto que o próximo envio sobrescreve.
   */
  async setCustomThumbnail(
    video: Video,
    file: { buffer: Buffer; mimetype: string },
  ): Promise<VideoResponse> {
    const jpeg = await this.thumbnailProcessor.normalize(
      file.buffer,
      file.mimetype,
    );
    const key = storageKeys(video.public_id).customThumbnail;
    await this.storage.putObject(key, jpeg, 'image/jpeg');
    await this.applyChanges(video, { custom_thumbnail_key: key });
    return this.getVideo(video);
  }

  /**
   * Volta à thumbnail automática (TD-04). Idempotente: sem customizada, não faz nada. Remove o
   * objeto antes de anular a chave — o `DeleteObject` do S3 tolera chave ausente, então repetir
   * após uma falha parcial é seguro.
   */
  async removeCustomThumbnail(video: Video): Promise<void> {
    if (!video.custom_thumbnail_key) {
      return;
    }
    await this.storage.deleteObject(video.custom_thumbnail_key);
    await this.applyChanges(video, { custom_thumbnail_key: null });
  }

  /**
   * Thumbnail pública e estável (video-channel-management/TD-10): a customizada tem prioridade
   * sobre a automática; `?v=` (epoch em ms de `updated_at`) muda a URL a cada escrita do vídeo,
   * invalidando o cache do navegador/CDN quando a imagem é trocada. `null` sem thumbnail.
   */
  thumbnailUrl(
    video: Pick<Video, 'custom_thumbnail_key' | 'thumbnail_key' | 'updated_at'>,
  ): string | null {
    const key = video.custom_thumbnail_key ?? video.thumbnail_key;
    if (!key) {
      return null;
    }
    return `${this.storage.publicUrl(key)}?v=${video.updated_at.getTime()}`;
  }

  /**
   * Grava as mudanças, espelha no objeto em memória e relê `updated_at` (gerado pelo banco) para
   * que a resposta traga o mesmo `?v=` da thumbnail que a próxima leitura trará.
   */
  private async applyChanges(
    video: Video,
    changes: Partial<Video>,
  ): Promise<void> {
    await this.videoRepository.update(video.id, changes);
    Object.assign(video, changes);
    const { updated_at } = await this.videoRepository.findOneOrFail({
      where: { id: video.id },
      select: { id: true, updated_at: true },
    });
    video.updated_at = updated_at;
  }

  private get videoRepository(): Repository<Video> {
    return this.dataSource.getRepository(Video);
  }

  /**
   * Canal dono do vídeo (resolução OQ-1 da Fase 05): usa a relação carregada por
   * `VideosOwnership`; senão busca pelo `channel_id`. A FK garante que o canal existe.
   */
  private async resolveChannel(video: Video): Promise<VideoCardChannel> {
    const channel =
      video.channel ?? (await this.channelsService.findById(video.channel_id));
    if (!channel) {
      throw new Error(`Video ${video.id} has no channel`);
    }
    return { nickname: channel.nickname, name: channel.name };
  }

  private async resolveCategory(
    video: Video,
  ): Promise<CategoryResponse | null> {
    if (!video.category_id) {
      return null;
    }
    const category =
      video.category ??
      (await this.categoriesService.findById(video.category_id));
    return category ? toCategoryResponse(category) : null;
  }

  /**
   * URLs GET pré-assinadas com o cliente público (TD-09): o storage atende `Range` e devolve o
   * `Content-Disposition` pedido na assinatura; nenhum byte passa pela API. A thumbnail é a URL
   * pública estável (TD-10), não assinada.
   */
  async getPlayback(video: Video): Promise<PlaybackResponse> {
    if (video.processing_status !== 'ready') {
      throw new VideoNotReadyException(video.processing_status);
    }
    const ttl = this.upload.playbackUrlTtlSeconds;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const [streamUrl, downloadUrl] = await Promise.all([
      this.storage.presignGetObject(video.storage_key, ttl, { public: true }),
      this.storage.presignGetObject(video.storage_key, ttl, {
        public: true,
        responseContentDisposition: attachmentDisposition(
          video.original_filename,
          video.content_type,
        ),
      }),
    ]);
    return {
      stream_url: streamUrl,
      download_url: downloadUrl,
      thumbnail_url: this.thumbnailUrl(video),
      expires_at: expiresAt.toISOString(),
    };
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
            title: deriveVideoTitle(dto.original_filename),
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
