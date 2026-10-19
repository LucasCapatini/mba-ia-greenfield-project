import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelsModule } from '../channels/channels.module';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { VideoUpload } from './entities/video-upload.entity';
import { Video } from './entities/video.entity';
import { VideosOwnership } from './videos-ownership';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

// Domínio de vídeo (Fase 03): pré-cadastro, orquestração do multipart, leitura e playback.
// Importa StorageModule (S3), QueueModule (pg-boss, só `send` aqui) e ChannelsModule (canal do dono).
@Module({
  imports: [
    TypeOrmModule.forFeature([Video, VideoUpload]),
    StorageModule,
    QueueModule,
    ChannelsModule,
  ],
  controllers: [VideosController],
  providers: [VideosService, VideosOwnership],
  exports: [VideosService],
})
export class VideosModule {}
