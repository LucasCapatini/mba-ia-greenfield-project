import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { QUEUE_NAMES, QUEUE_SEND_DEFAULTS } from '../queue/queue.constants';
import { type QueueJob, QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { VIDEO_DELETE_WORK_OPTIONS } from './worker.constants';

type VideoDeleteJob = QueueJob<typeof QUEUE_NAMES.VIDEO_DELETE>;

// Consumidor de `video.delete` (video-channel-management/TD-09): remove do storage o vídeo e as
// thumbnails de um vídeo já apagado do banco (as chaves vêm no payload). At-least-once e
// idempotente — `DeleteObject` do S3 responde sucesso para chave ausente, então repetir é
// seguro. Contexto de background: falha de storage relança para o retry do pg-boss; na última
// tentativa registra as chaves que sobraram (objetos completos não têm lifecycle no bucket).
@Injectable()
export class VideoDeletionWorker implements OnModuleInit {
  private readonly logger = new Logger(VideoDeletionWorker.name);

  constructor(
    private readonly queue: QueueService,
    private readonly storage: StorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.work(
      QUEUE_NAMES.VIDEO_DELETE,
      VIDEO_DELETE_WORK_OPTIONS,
      async (jobs) => {
        for (const job of jobs) {
          await this.handle(job);
        }
      },
    );
    this.logger.log(`Listening on ${QUEUE_NAMES.VIDEO_DELETE}`);
  }

  /** Apaga cada chave; lança se alguma falhou, para o pg-boss retentar o job inteiro. */
  async handle(job: VideoDeleteJob): Promise<void> {
    const { videoId, publicId, storageKey, thumbnailKeys } = job.data;
    const tag = `[video ${videoId} (${publicId}), job ${job.id}, attempt ${job.retryCount + 1}]`;
    const keys = [storageKey, ...thumbnailKeys];

    const remaining: string[] = [];
    let lastError: unknown;
    for (const key of keys) {
      try {
        await this.storage.deleteObject(key);
      } catch (error) {
        remaining.push(key);
        lastError = error;
      }
    }

    if (remaining.length === 0) {
      this.logger.log(`${tag} removed ${keys.length} object(s)`);
      return;
    }
    const retryLimit = QUEUE_SEND_DEFAULTS[QUEUE_NAMES.VIDEO_DELETE].retryLimit;
    if (job.retryCount >= retryLimit) {
      this.logger.error(
        `${tag} video.delete failed after last attempt; remaining keys: ${remaining.join(', ')}`,
      );
    }
    throw lastError;
  }
}
