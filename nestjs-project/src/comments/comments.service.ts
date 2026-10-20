import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import {
  DataSource,
  type EntityManager,
  In,
  QueryFailedError,
  Repository,
  type SelectQueryBuilder,
} from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import {
  type CursorPosition,
  decodeCursor,
  encodeCursor,
  InvalidCursorException,
} from '../common/pagination/cursor';
import { CommentReactionsService } from '../reactions/comment-reactions.service';
import type { VideoCardChannel } from '../videos/dto/video-response.dto';
import { Video } from '../videos/entities/video.entity';
import { VideoNotFoundException } from '../videos/videos.exceptions';
import type { CommentSort } from './comments.constants';
import {
  CommentForbiddenException,
  CommentNotFoundException,
} from './comments.exceptions';
import type { CommentResponse, CommentsPage } from './dto/comment-response.dto';
import { Comment } from './entities/comment.entity';

/** Separador do valor composto do cursor `top` (`like_count|created_at`). */
const TOP_CURSOR_SEPARATOR = '|';
/** Nome da ordenação gravado no cursor das respostas (sempre cronológica). */
const REPLIES_CURSOR_SORT = 'oldest';
const PG_FOREIGN_KEY_VIOLATION = '23503';

function isForeignKeyViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err as unknown as { code?: string }).code === PG_FOREIGN_KEY_VIOLATION
  );
}

/**
 * Comentários de vídeos (social-interactions/TD-05..TD-07). Só vídeos `published` (público ou
 * unlisted) recebem e expõem comentários — inclusive para o dono (TD-03, Revisions 2026-10-20).
 * `videos.comment_count` conta raízes e respostas e muda na mesma transação do evento (TD-02), por
 * SQL direto para não tocar no `updated_at` do vídeo (que versiona a URL da thumbnail). O vídeo e o
 * canal do autor são lidos pelos próprios repositórios, sem importar VideosModule/ChannelsModule.
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Comment)
    private readonly comments: Repository<Comment>,
    @InjectRepository(Video)
    private readonly videos: Repository<Video>,
    @InjectRepository(Channel)
    private readonly channels: Repository<Channel>,
    private readonly commentReactions: CommentReactionsService,
  ) {}

  /** Comentário raiz; `comment_count + 1` na mesma transação. */
  async create(
    publicId: string,
    userId: string,
    text: string,
  ): Promise<CommentResponse> {
    const video = await this.findPublishedVideo(publicId);
    const comment = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Comment);
      const saved = await repository.save(
        repository.create({ video_id: video.id, user_id: userId, text }),
      );
      await this.moveVideoCounter(manager, video.id, 1);
      return saved;
    });
    return this.toResponse(comment, userId);
  }

  /**
   * Raízes do vídeo em keyset (TD-06): `latest` = `created_at DESC, id DESC`; `top` =
   * `like_count DESC, created_at DESC, id DESC`. O cursor guarda o `created_at` como texto do banco
   * (microssegundos — ver `CursorPosition`) e, no `top`, também o `like_count`.
   */
  async listRoots(
    publicId: string,
    query: { sort: CommentSort; cursor?: string; limit: number },
    viewerId?: string,
  ): Promise<CommentsPage> {
    const video = await this.findPublishedVideo(publicId);
    const qb = this.comments
      .createQueryBuilder('comment')
      .where('comment.video_id = :videoId', { videoId: video.id })
      .andWhere('comment.parent_id IS NULL');

    if (query.cursor) {
      const position = decodeCursor(query.cursor, query.sort);
      if (query.sort === 'top') {
        const { likes, createdAt } = parseTopValue(position.value);
        qb.andWhere(
          '(comment.like_count, comment.created_at, comment.id) < (CAST(:likes AS integer), CAST(:createdAt AS timestamp), CAST(:cursorId AS uuid))',
          { likes, createdAt, cursorId: position.id },
        );
      } else {
        qb.andWhere(
          '(comment.created_at, comment.id) < (CAST(:createdAt AS timestamp), CAST(:cursorId AS uuid))',
          { createdAt: position.value, cursorId: position.id },
        );
      }
    }
    if (query.sort === 'top') {
      qb.orderBy('comment.like_count', 'DESC').addOrderBy(
        'comment.created_at',
        'DESC',
      );
    } else {
      qb.orderBy('comment.created_at', 'DESC');
    }
    qb.addOrderBy('comment.id', 'DESC');

    return this.readPage(qb, query.limit, viewerId, (last, createdAt) => ({
      sort: query.sort,
      value:
        query.sort === 'top'
          ? `${last.like_count}${TOP_CURSOR_SEPARATOR}${createdAt}`
          : createdAt,
      id: last.id,
    }));
  }

  /**
   * Resposta (TD-05, um nível): se `commentId` já é uma resposta, a nova vai para a raiz dela. A
   * resposta, `reply_count + 1` na raiz e `comment_count + 1` no vídeo saem na mesma transação; se
   * a raiz some entre a leitura e a escrita, a FK recusa o INSERT e a resposta é 404.
   */
  async reply(
    commentId: string,
    userId: string,
    text: string,
  ): Promise<CommentResponse> {
    const target = await this.findVisibleComment(commentId);
    const rootId = target.parent_id ?? target.id;
    try {
      const reply = await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(Comment);
        const saved = await repository.save(
          repository.create({
            video_id: target.video_id,
            user_id: userId,
            parent_id: rootId,
            text,
          }),
        );
        await manager.query(
          'UPDATE "comments" SET "reply_count" = "reply_count" + 1 WHERE "id" = $1',
          [rootId],
        );
        await this.moveVideoCounter(manager, target.video_id, 1);
        return saved;
      });
      return await this.toResponse(reply, userId);
    } catch (err) {
      if (isForeignKeyViolation(err)) throw new CommentNotFoundException();
      throw err;
    }
  }

  /**
   * Respostas de uma raiz em ordem cronológica (`created_at ASC, id ASC`, TD-06), em keyset.
   * `commentId` que é uma resposta → 404 `COMMENT_NOT_FOUND` (não há segundo nível).
   */
  async listReplies(
    commentId: string,
    query: { cursor?: string; limit: number },
    viewerId?: string,
  ): Promise<CommentsPage> {
    const root = await this.findVisibleComment(commentId);
    if (root.parent_id !== null) throw new CommentNotFoundException();

    const qb = this.comments
      .createQueryBuilder('comment')
      .where('comment.parent_id = :rootId', { rootId: root.id });
    if (query.cursor) {
      const position = decodeCursor(query.cursor, REPLIES_CURSOR_SORT);
      qb.andWhere(
        '(comment.created_at, comment.id) > (CAST(:createdAt AS timestamp), CAST(:cursorId AS uuid))',
        { createdAt: position.value, cursorId: position.id },
      );
    }
    qb.orderBy('comment.created_at', 'ASC').addOrderBy('comment.id', 'ASC');

    return this.readPage(qb, query.limit, viewerId, (last, createdAt) => ({
      sort: REPLIES_CURSOR_SORT,
      value: createdAt,
      id: last.id,
    }));
  }

  /** Só o autor edita (TD-06/TD-07); grava `edited_at`. */
  async update(
    commentId: string,
    userId: string,
    text: string,
  ): Promise<CommentResponse> {
    const comment = await this.findVisibleComment(commentId);
    if (comment.user_id !== userId) {
      throw new CommentForbiddenException();
    }
    await this.comments.update(
      { id: comment.id },
      { text, edited_at: new Date() },
    );
    const updated = await this.comments.findOneByOrFail({ id: comment.id });
    return this.toResponse(updated, userId);
  }

  /**
   * Exclusão física pelo autor (TD-07). Raiz: as respostas e as reações caem em cascata e o vídeo
   * perde `1 + reply_count`; resposta: o vídeo perde 1 e a raiz, uma resposta. O `DELETE …
   * RETURNING` devolve o `reply_count` vigente — sem linha (outra exclusão venceu) nada muda.
   */
  async remove(commentId: string, userId: string): Promise<void> {
    const comment = await this.findVisibleComment(commentId);
    if (comment.user_id !== userId) {
      throw new CommentForbiddenException();
    }
    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .delete()
        .from(Comment)
        .where({ id: comment.id })
        .returning(['reply_count', 'parent_id'])
        .execute();
      const [deleted] = result.raw as {
        reply_count: number;
        parent_id: string | null;
      }[];
      if (!deleted) return;
      if (deleted.parent_id === null) {
        await this.moveVideoCounter(
          manager,
          comment.video_id,
          -(1 + deleted.reply_count),
        );
        return;
      }
      await this.moveVideoCounter(manager, comment.video_id, -1);
      await manager.query(
        'UPDATE "comments" SET "reply_count" = "reply_count" - 1 WHERE "id" = $1',
        [deleted.parent_id],
      );
    });
  }

  /**
   * Executa a consulta já ordenada buscando `limit + 1` linhas (há próxima página sem contar) e
   * monta o cursor a partir da última entregue, com o `created_at` como texto do banco.
   */
  private async readPage(
    qb: SelectQueryBuilder<Comment>,
    limit: number,
    viewerId: string | undefined,
    positionOf: (last: Comment, createdAt: string) => CursorPosition,
  ): Promise<CommentsPage> {
    qb.addSelect('comment.created_at::text', 'created_at_text').limit(
      limit + 1,
    );
    // Sem joins: cada linha crua corresponde a uma entidade, na mesma ordem.
    const { entities, raw } = await qb.getRawAndEntities<{
      created_at_text: string;
    }>();
    const page = entities.slice(0, limit);
    const nextCursor =
      entities.length > limit
        ? encodeCursor(
            positionOf(
              page[page.length - 1],
              raw[page.length - 1].created_at_text,
            ),
          )
        : null;
    return {
      items: await this.toResponses(page, viewerId),
      next_cursor: nextCursor,
    };
  }

  private async findPublishedVideo(publicId: string): Promise<Video> {
    const video = await this.videos.findOneBy({
      public_id: publicId,
      status: 'published',
    });
    if (!video) throw new VideoNotFoundException();
    return video;
  }

  /** Id malformado, inexistente ou de vídeo não `published` → 404 `COMMENT_NOT_FOUND`. */
  private async findVisibleComment(commentId: string): Promise<Comment> {
    if (!isUUID(commentId)) throw new CommentNotFoundException();
    const comment = await this.comments.findOne({
      where: { id: commentId },
      relations: { video: true },
    });
    if (!comment || comment.video.status !== 'published') {
      throw new CommentNotFoundException();
    }
    return comment;
  }

  private async moveVideoCounter(
    manager: EntityManager,
    videoId: string,
    delta: number,
  ): Promise<void> {
    await manager.query(
      'UPDATE "videos" SET "comment_count" = "comment_count" + $1 WHERE "id" = $2',
      [delta, videoId],
    );
  }

  private async toResponse(
    comment: Comment,
    viewerId: string | undefined,
  ): Promise<CommentResponse> {
    const [response] = await this.toResponses([comment], viewerId);
    return response;
  }

  /** Autores (canal de cada usuário) e reações do espectador em uma consulta cada, para a página toda. */
  private async toResponses(
    comments: Comment[],
    viewerId: string | undefined,
  ): Promise<CommentResponse[]> {
    if (comments.length === 0) return [];
    const userIds = [...new Set(comments.map((comment) => comment.user_id))];
    const [authors, reactions] = await Promise.all([
      this.channels.find({
        select: { user_id: true, nickname: true, name: true },
        where: { user_id: In(userIds) },
      }),
      this.commentReactions.findViewerReactions(
        comments.map((comment) => comment.id),
        viewerId,
      ),
    ]);
    const authorByUser = new Map<string, VideoCardChannel>(
      authors.map((channel) => [
        channel.user_id,
        { nickname: channel.nickname, name: channel.name },
      ]),
    );
    return comments.map((comment) => {
      const author = authorByUser.get(comment.user_id);
      if (!author) {
        throw new Error(`User ${comment.user_id} has no channel`);
      }
      return {
        id: comment.id,
        parent_id: comment.parent_id ?? null,
        text: comment.text,
        author,
        created_at: comment.created_at.toISOString(),
        edited_at: comment.edited_at ? comment.edited_at.toISOString() : null,
        like_count: comment.like_count,
        dislike_count: comment.dislike_count,
        reply_count: comment.reply_count,
        viewer_reaction: reactions.get(comment.id) ?? null,
        viewer_is_author:
          viewerId !== undefined && comment.user_id === viewerId,
      };
    });
  }
}

/** `like_count|created_at` do cursor `top`; qualquer outra forma é cursor adulterado (400). */
function parseTopValue(value: string): { likes: string; createdAt: string } {
  const separator = value.indexOf(TOP_CURSOR_SEPARATOR);
  const likes = value.slice(0, separator);
  const createdAt = value.slice(separator + 1);
  if (separator <= 0 || !/^\d+$/.test(likes) || createdAt.length === 0) {
    throw new InvalidCursorException();
  }
  return { likes, createdAt };
}
