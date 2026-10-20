import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import {
  VIDEO_VIEWS_CLEANUP_CRON,
  VIDEO_VIEWS_CLEANUP_WORK_OPTIONS,
  VIDEO_VIEWS_RETENTION_DAYS,
} from './worker.constants';

// Consumidor do job agendado `video-views.cleanup` (watch-page/TD-02, Revisions 2026-10-19). Só o
// balde do dia UTC corrente deduplica visualizações novas; os vencidos são lixo e saem uma vez por
// dia. O DELETE é idempotente, então reexecução ou atraso não mudam o resultado; falha relança
// para o retry do pg-boss e o que sobrar é varrido no dia seguinte.
@Injectable()
export class VideoViewsCleanupWorker implements OnModuleInit {
  private readonly logger = new Logger(VideoViewsCleanupWorker.name);

  constructor(
    private readonly queue: QueueService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    // Reagendar sobrescreve o agendamento existente: subir o worker de novo é seguro.
    await this.queue.schedule(
      QUEUE_NAMES.VIDEO_VIEWS_CLEANUP,
      VIDEO_VIEWS_CLEANUP_CRON,
      {},
    );
    await this.queue.work(
      QUEUE_NAMES.VIDEO_VIEWS_CLEANUP,
      VIDEO_VIEWS_CLEANUP_WORK_OPTIONS,
      async () => {
        await this.handle();
      },
    );
    this.logger.log(
      `Listening on ${QUEUE_NAMES.VIDEO_VIEWS_CLEANUP} (cron ${VIDEO_VIEWS_CLEANUP_CRON} UTC)`,
    );
  }

  /** Apaga as linhas com `window_start` anterior a VIDEO_VIEWS_RETENTION_DAYS dias (UTC); devolve quantas. */
  async handle(): Promise<number> {
    const [, deleted] = await this.dataSource.query<[unknown[], number]>(
      `DELETE FROM "video_views"
       WHERE "window_start" < (now() AT TIME ZONE 'UTC')::date - $1::int`,
      [VIDEO_VIEWS_RETENTION_DAYS],
    );
    this.logger.log(`video-views.cleanup removed ${deleted} row(s)`);
    return deleted;
  }
}
