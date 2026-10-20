import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Video } from '../videos/entities/video.entity';
import { VideoNotFoundException } from '../videos/videos.exceptions';
import type { ReactionStateResponse } from './dto/reaction-state-response.dto';
import { VideoReaction } from './entities/video-reaction.entity';
import { reactionDelta } from './reaction-transition';
import { writeReaction } from './reaction-writer';
import type { ReactionValue } from './reactions.constants';

/**
 * Reações a vídeos (social-interactions/TD-01, TD-02, TD-03). Só vídeos `published` aceitam
 * reação — rascunho → 404 inclusive para o dono (TD-03, Revisions 2026-10-20). A linha de
 * `video_reactions` e os contadores de `videos` mudam na mesma transação. O vídeo é lido pelo
 * próprio repositório (sem importar o VideosModule), para o VideosModule poder importar este
 * módulo sem ciclo (SI-06.4).
 */
@Injectable()
export class VideoReactionsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Video)
    private readonly videos: Repository<Video>,
    @InjectRepository(VideoReaction)
    private readonly reactions: Repository<VideoReaction>,
  ) {}

  async set(
    publicId: string,
    userId: string,
    value: ReactionValue,
  ): Promise<ReactionStateResponse> {
    return this.write(publicId, userId, value);
  }

  async remove(
    publicId: string,
    userId: string,
  ): Promise<ReactionStateResponse> {
    return this.write(publicId, userId, null);
  }

  /** Reação do espectador a um vídeo — `null` para anônimo ou sem reação (TD-04). */
  async findViewerReaction(
    videoId: string,
    userId: string | undefined,
  ): Promise<ReactionValue | null> {
    if (!userId) return null;
    const reaction = await this.reactions.findOneBy({
      user_id: userId,
      video_id: videoId,
    });
    return reaction?.value ?? null;
  }

  private async write(
    publicId: string,
    userId: string,
    next: ReactionValue | null,
  ): Promise<ReactionStateResponse> {
    const video = await this.videos.findOneBy({
      public_id: publicId,
      status: 'published',
    });
    if (!video) throw new VideoNotFoundException();

    return this.dataSource.transaction(async (manager) => {
      const previous = await writeReaction(
        manager,
        VideoReaction,
        { user_id: userId, video_id: video.id },
        next,
      );
      const delta = reactionDelta(previous, next);
      if (delta.like !== 0 || delta.dislike !== 0) {
        // SQL direto: o update do TypeORM também mexeria em `updated_at`, que versiona a URL
        // pública da thumbnail (`?v=`) — um like não pode invalidar o cache da imagem.
        await manager.query(
          'UPDATE "videos" SET "like_count" = "like_count" + $1, "dislike_count" = "dislike_count" + $2 WHERE "id" = $3',
          [delta.like, delta.dislike, video.id],
        );
      }
      const [counts] = await manager.query<
        { like_count: number; dislike_count: number }[]
      >('SELECT "like_count", "dislike_count" FROM "videos" WHERE "id" = $1', [
        video.id,
      ]);
      return {
        viewer_reaction: next,
        like_count: counts.like_count,
        dislike_count: counts.dislike_count,
      };
    });
  }
}
