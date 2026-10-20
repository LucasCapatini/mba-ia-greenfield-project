import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from '../comments/entities/comment.entity';
import { Video } from '../videos/entities/video.entity';
import { CommentReactionsController } from './comment-reactions.controller';
import { CommentReactionsService } from './comment-reactions.service';
import { CommentReaction } from './entities/comment-reaction.entity';
import { VideoReaction } from './entities/video-reaction.entity';
import { VideoReactionsController } from './video-reactions.controller';
import { VideoReactionsService } from './video-reactions.service';

// Reações a vídeos e comentários (social-interactions/TD-01..TD-03). Lê `Video` e `Comment` pelos
// próprios repositórios em vez de importar VideosModule/CommentsModule: os dois importam este
// módulo para o `viewer_reaction` das leituras (TD-04), então a dependência só pode ir num sentido.
@Module({
  imports: [
    TypeOrmModule.forFeature([VideoReaction, CommentReaction, Video, Comment]),
  ],
  controllers: [VideoReactionsController, CommentReactionsController],
  providers: [VideoReactionsService, CommentReactionsService],
  exports: [VideoReactionsService, CommentReactionsService],
})
export class ReactionsModule {}
