import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module';
import { ChannelsModule } from '../channels/channels.module';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { ChannelVideosController } from './channel-videos.controller';
import { VideoUpload } from './entities/video-upload.entity';
import { ThumbnailUploadInterceptor } from './thumbnail-upload.interceptor';
import { ThumbnailProcessor } from './thumbnail.processor';
import { Video } from './entities/video.entity';
import { VideosOwnership } from './videos-ownership';
import { VideosListingService } from './videos-listing.service';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

// Domínio de vídeo (Fase 03): pré-cadastro, orquestração do multipart, leitura e playback.
// Importa StorageModule (S3), QueueModule (pg-boss, só `send` aqui), ChannelsModule (canal do dono)
// e CategoriesModule (categoria do vídeo — Fase 04).
@Module({
  imports: [
    TypeOrmModule.forFeature([Video, VideoUpload]),
    StorageModule,
    QueueModule,
    ChannelsModule,
    CategoriesModule,
  ],
  controllers: [VideosController, ChannelVideosController],
  providers: [
    VideosService,
    VideosOwnership,
    ThumbnailProcessor,
    ThumbnailUploadInterceptor,
    VideosListingService,
  ],
  exports: [VideosService],
})
export class VideosModule {}
