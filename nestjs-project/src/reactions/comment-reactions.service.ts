import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource, In, Repository } from 'typeorm';
import { Comment } from '../comments/entities/comment.entity';
import { CommentNotFoundException } from '../comments/comments.exceptions';
import type { ReactionStateResponse } from './dto/reaction-state-response.dto';
import { CommentReaction } from './entities/comment-reaction.entity';
import { reactionDelta } from './reaction-transition';
import { writeReaction } from './reaction-writer';
import type { ReactionValue } from './reactions.constants';

/**
 * Reações a comentários e respostas (social-interactions/TD-01..TD-03): mesma semântica e mesmo
 * protocolo das reações a vídeo — a linha de `comment_reactions` e os contadores do comentário
 * mudam na mesma transação. Comentário inexistente, id malformado ou de vídeo não `published` →
 * 404 `COMMENT_NOT_FOUND`. O comentário é lido pelo próprio repositório (sem importar o
 * CommentsModule, que importa este módulo para o `viewer_reaction` das listagens).
 */
@Injectable()
export class CommentReactionsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Comment)
    private readonly comments: Repository<Comment>,
    @InjectRepository(CommentReaction)
    private readonly reactions: Repository<CommentReaction>,
  ) {}

  async set(
    commentId: string,
    userId: string,
    value: ReactionValue,
  ): Promise<ReactionStateResponse> {
    return this.write(commentId, userId, value);
  }

  async remove(
    commentId: string,
    userId: string,
  ): Promise<ReactionStateResponse> {
    return this.write(commentId, userId, null);
  }

  /**
   * Reações do espectador a uma página de comentários, numa única consulta pela PK
   * `(user_id, comment_id)` (TD-04/TD-06). Anônimo ou página vazia → mapa vazio (nenhuma consulta).
   */
  async findViewerReactions(
    commentIds: string[],
    userId: string | undefined,
  ): Promise<Map<string, ReactionValue>> {
    if (!userId || commentIds.length === 0) return new Map();
    const rows = await this.reactions.find({
      select: { comment_id: true, value: true },
      where: { user_id: userId, comment_id: In(commentIds) },
    });
    return new Map(rows.map((row) => [row.comment_id, row.value]));
  }

  private async write(
    commentId: string,
    userId: string,
    next: ReactionValue | null,
  ): Promise<ReactionStateResponse> {
    if (!isUUID(commentId)) throw new CommentNotFoundException();
    const comment = await this.comments.findOne({
      where: { id: commentId },
      relations: { video: true },
    });
    if (!comment || comment.video.status !== 'published') {
      throw new CommentNotFoundException();
    }

    return this.dataSource.transaction(async (manager) => {
      const previous = await writeReaction(
        manager,
        CommentReaction,
        { user_id: userId, comment_id: comment.id },
        next,
      );
      const delta = reactionDelta(previous, next);
      if (delta.like !== 0 || delta.dislike !== 0) {
        await manager.query(
          'UPDATE "comments" SET "like_count" = "like_count" + $1, "dislike_count" = "dislike_count" + $2 WHERE "id" = $3',
          [delta.like, delta.dislike, comment.id],
        );
      }
      const [counts] = await manager.query<
        { like_count: number; dislike_count: number }[]
      >(
        'SELECT "like_count", "dislike_count" FROM "comments" WHERE "id" = $1',
        [comment.id],
      );
      // Comentário excluído no meio da escrita: a cascata levou a reação junto.
      if (!counts) throw new CommentNotFoundException();
      return {
        viewer_reaction: next,
        like_count: counts.like_count,
        dislike_count: counts.dislike_count,
      };
    });
  }
}
