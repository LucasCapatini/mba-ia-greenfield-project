import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from '../channels/entities/channel.entity';
import { ReactionsModule } from '../reactions/reactions.module';
import { Video } from '../videos/entities/video.entity';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';
import { VideoCommentsController } from './video-comments.controller';

// Comentários (social-interactions/TD-05..TD-07). Lê `Video` (vídeo publicado) e `Channel` (autor)
// pelos próprios repositórios, sem importar VideosModule/ChannelsModule; o ReactionsModule dá o
// `viewer_reaction` dos comentários.
@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, Video, Channel]),
    ReactionsModule,
  ],
  controllers: [VideoCommentsController, CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
