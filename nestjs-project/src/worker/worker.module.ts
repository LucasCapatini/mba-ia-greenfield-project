import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  configModuleOptions,
  typeOrmWorkerModuleAsyncOptions,
} from '../config/config-module.options';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { VideoUpload } from '../videos/entities/video-upload.entity';
import { Video } from '../videos/entities/video.entity';
import { FfmpegService } from './ffmpeg.service';
import { UploadExpirationWorker } from './upload-expiration.worker';
import { VideoProcessingWorker } from './video-processing.worker';

// Raiz do processo `video-worker` (phase-03-upload-processing/TD-05): mesmo .env, mesmo banco e
// mesmo storage da API, mas sem HTTP, guards, throttler ou mailer. NUNCA importa o AppModule —
// isso arrastaria o servidor HTTP e o guard global para dentro do worker.
// Handlers das filas: `video.process` (VideoProcessingWorker); `upload.expire` (UploadExpirationWorker).
@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions),
    TypeOrmModule.forRootAsync(typeOrmWorkerModuleAsyncOptions),
    TypeOrmModule.forFeature([Video, VideoUpload]),
    StorageModule,
    QueueModule,
  ],
  providers: [FfmpegService, VideoProcessingWorker, UploadExpirationWorker],
})
export class WorkerModule {}
