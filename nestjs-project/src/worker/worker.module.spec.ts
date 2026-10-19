import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { FfmpegService } from './ffmpeg.service';
import { UploadExpirationWorker } from './upload-expiration.worker';
import { VideoProcessingWorker } from './video-processing.worker';
import { WorkerModule } from './worker.module';

describe('WorkerModule', () => {
  it('should compile standalone (own ConfigModule + TypeORM) and resolve queue, storage and the DataSource', async () => {
    // Sem `init()`: o pg-boss só conecta em onModuleInit; o TypeORM abre o DataSource na compilação
    // (mesmo padrão dos demais *.module.spec.ts do projeto).
    const module = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();

    expect(module.get(QueueService)).toBeInstanceOf(QueueService);
    expect(module.get(StorageService)).toBeInstanceOf(StorageService);
    expect(module.get(DataSource)).toBeInstanceOf(DataSource);
    expect(module.get(FfmpegService)).toBeInstanceOf(FfmpegService);
    expect(module.get(VideoProcessingWorker)).toBeInstanceOf(
      VideoProcessingWorker,
    );
    expect(module.get(UploadExpirationWorker)).toBeInstanceOf(
      UploadExpirationWorker,
    );

    // TD-05: o worker não carrega auth nem mailer — nada de HTTP/guards/SMTP no processo.
    expect(() => module.get(AuthService)).toThrow();
    expect(() => module.get(MailService)).toThrow();

    await module.close();
  }, 30000);
});
