import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { type QueueJob, QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { VideoUpload } from '../videos/entities/video-upload.entity';
import { Video } from '../videos/entities/video.entity';
import { UPLOAD_EXPIRE_WORK_OPTIONS } from './worker.constants';

type UploadExpireJob = QueueJob<typeof QUEUE_NAMES.UPLOAD_EXPIRE>;

// Consumidor de `upload.expire` (phase-03-upload-processing/TD-12): o job atrasado agendado no
// pré-cadastro fecha o ciclo da sessão multipart sem cron nem varredura. Idempotente por guarda
// de estado — a transição `active → expired` acontece primeiro e decide tudo: zero linhas
// afetadas significa que o `complete`/`abort` venceu a corrida (TD-11) e o job vira no-op sem
// tocar no storage. Contexto de background: loga; só relança o que deve ser retentado.
@Injectable()
export class UploadExpirationWorker implements OnModuleInit {
  private readonly logger = new Logger(UploadExpirationWorker.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(VideoUpload)
    private readonly uploadRepository: Repository<VideoUpload>,
    private readonly queue: QueueService,
    private readonly storage: StorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.work(
      QUEUE_NAMES.UPLOAD_EXPIRE,
      UPLOAD_EXPIRE_WORK_OPTIONS,
      async (jobs) => {
        for (const job of jobs) {
          await this.handle(job);
        }
      },
    );
    this.logger.log(`Listening on ${QUEUE_NAMES.UPLOAD_EXPIRE}`);
  }

  /** Expira a sessão se ainda estiver ativa; lança apenas em falha transitória (retry do pg-boss). */
  async handle(job: UploadExpireJob): Promise<void> {
    const { videoId } = job.data;
    const tag = `[video ${videoId}, job ${job.id}, attempt ${job.retryCount + 1}]`;

    const session = await this.uploadRepository.findOne({
      where: { video_id: videoId },
      relations: ['video'],
    });
    if (!session) {
      this.logger.log(`${tag} no upload session — no-op`);
      return;
    }
    if (session.state !== 'active') {
      this.logger.log(`${tag} session already ${session.state} — no-op`);
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      // Guarda da corrida com `complete`/`abort`: só quem vira a linha de `active` segue.
      const expired = await manager.update(
        VideoUpload,
        { id: session.id, state: 'active' },
        { state: 'expired' },
      );
      if (!expired.affected) {
        this.logger.log(`${tag} session changed concurrently — no-op`);
        return;
      }
      // Tolera NoSuchUpload (lifecycle do bucket pode ter abortado antes); outros erros relançam
      // e desfazem a transição, deixando o retry do pg-boss tentar de novo.
      await this.storage.abortMultipartUpload(
        session.video.storage_key,
        session.upload_id,
      );
      this.logger.log(
        `${tag} upload ${session.upload_id} aborted; draft ${session.video.public_id} removed (expired at ${session.expires_at.toISOString()})`,
      );
      await manager.delete(Video, { id: videoId });
    });
  }
}
