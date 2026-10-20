import { Injectable } from '@nestjs/common';
import { DataSource, type SelectQueryBuilder } from 'typeorm';
import type { Channel } from '../channels/entities/channel.entity';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import type {
  ChannelVideoSort,
  ListChannelVideosDto,
  ListOwnerVideosDto,
  OwnerVideoSort,
} from './dto/list-videos.dto';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import type {
  ChannelVideosPage,
  OwnerVideosPage,
  RelatedVideosResponse,
  SubscriptionFeedPage,
} from './dto/video-pages.dto';
import type { VideoCardItem, VideoListItem } from './dto/video-response.dto';
import { Video } from './entities/video.entity';
import { VideosService } from './videos.service';

type SortColumn = 'created_at' | 'published_at' | 'view_count';

interface SortSpec {
  column: SortColumn;
  direction: 'ASC' | 'DESC';
  /** Tipo para reconverter o valor textual do cursor na comparação. */
  cast: 'timestamp' | 'integer';
}

const OWNER_SORTS: Record<OwnerVideoSort, SortSpec> = {
  latest: { column: 'created_at', direction: 'DESC', cast: 'timestamp' },
  oldest: { column: 'created_at', direction: 'ASC', cast: 'timestamp' },
  views: { column: 'view_count', direction: 'DESC', cast: 'integer' },
};

const CHANNEL_SORTS: Record<ChannelVideoSort, SortSpec> = {
  latest: { column: 'published_at', direction: 'DESC', cast: 'timestamp' },
  oldest: { column: 'published_at', direction: 'ASC', cast: 'timestamp' },
  popular: { column: 'view_count', direction: 'DESC', cast: 'integer' },
};

/** `%`, `_` e `\` da busca são literais no ILIKE. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}

/**
 * Listagens paginadas por cursor keyset (video-channel-management/TD-06): ordena por
 * `(coluna, id)` e continua de `(valor, id)` do cursor, então inserções entre páginas não
 * deslocam itens. Busca `limit + 1` para saber se há próxima página sem contar.
 */
@Injectable()
export class VideosListingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly videosService: VideosService,
  ) {}

  /** Painel do dono: todos os status, filtros, busca no título e `total` dos filtros. */
  async listOwnerVideos(
    channelId: string,
    query: ListOwnerVideosDto,
  ): Promise<OwnerVideosPage> {
    const qb = this.videos().where('video.channel_id = :channelId', {
      channelId,
    });
    if (query.status) {
      qb.andWhere('video.status = :status', { status: query.status });
    }
    if (query.visibility) {
      qb.andWhere('video.visibility = :visibility', {
        visibility: query.visibility,
      });
    }
    if (query.processing_status) {
      qb.andWhere('video.processing_status = :processingStatus', {
        processingStatus: query.processing_status,
      });
    }
    if (query.q) {
      qb.andWhere('video.title ILIKE :q', { q: `%${escapeLike(query.q)}%` });
    }
    if (query.from) {
      qb.andWhere('video.created_at >= CAST(:from AS date)', {
        from: query.from,
      });
    }
    if (query.to) {
      qb.andWhere("video.created_at < CAST(:to AS date) + INTERVAL '1 day'", {
        to: query.to,
      });
    }

    const total = await qb.clone().getCount();
    const { videos, nextCursor } = await this.page(
      qb,
      query.sort,
      OWNER_SORTS[query.sort],
      query,
    );
    return {
      items: videos.map((video) => this.toListItem(video)),
      next_cursor: nextCursor,
      total,
    };
  }

  /** Página pública do canal: só `published` + `public`. */
  async listChannelPublicVideos(
    channel: Pick<Channel, 'id' | 'nickname' | 'name'>,
    query: ListChannelVideosDto,
  ): Promise<ChannelVideosPage> {
    const qb = this.videos()
      .where('video.channel_id = :channelId', { channelId: channel.id })
      .andWhere("video.status = 'published'")
      .andWhere("video.visibility = 'public'")
      .andWhere('video.published_at IS NOT NULL');

    const { videos, nextCursor } = await this.page(
      qb,
      query.sort,
      CHANNEL_SORTS[query.sort],
      query,
    );
    return {
      items: videos.map((video) => this.toCardItem(video, channel)),
      next_cursor: nextCursor,
    };
  }

  /**
   * Feed das inscrições (social-interactions/TD-08): vídeos `published` + `public` + `ready` dos
   * canais que o usuário segue, montado na leitura por join com `subscriptions` (sem fan-out na
   * escrita), do mais recente ao mais antigo em keyset `latest`. Os joins são 1:1 por vídeo (PK
   * da inscrição e canal dono), então as linhas cruas continuam alinhadas às entidades.
   */
  async listSubscriptionFeed(
    userId: string,
    query: { cursor?: string; limit: number },
  ): Promise<SubscriptionFeedPage> {
    const qb = this.videos()
      .innerJoin(
        Subscription,
        'subscription',
        'subscription.channel_id = video.channel_id AND subscription.user_id = :userId',
        { userId },
      )
      .innerJoinAndSelect('video.channel', 'channel')
      .where("video.status = 'published'")
      .andWhere("video.visibility = 'public'")
      .andWhere("video.processing_status = 'ready'")
      .andWhere('video.published_at IS NOT NULL');

    const { videos, nextCursor } = await this.page(
      qb,
      'latest',
      CHANNEL_SORTS.latest,
      query,
    );
    return {
      items: videos.map((video) => this.toCardItem(video, video.channel)),
      next_cursor: nextCursor,
    };
  }

  /**
   * Sugestões da watch page (watch-page/TD-04): só `published` + `public` + `ready`, nunca o
   * próprio vídeo. Primeiro a mesma categoria por `published_at` decrescente; se faltar (ou o
   * vídeo não tem categoria), completa com os públicos mais recentes das demais, sem repetir.
   */
  async listRelated(
    video: Pick<Video, 'id' | 'category_id'>,
    limit: number,
  ): Promise<RelatedVideosResponse> {
    const related: Video[] = [];
    if (video.category_id) {
      related.push(
        ...(await this.relatedCandidates(video.id, limit)
          .andWhere('video.category_id = :categoryId', {
            categoryId: video.category_id,
          })
          .getMany()),
      );
    }
    if (related.length < limit) {
      const fill = this.relatedCandidates(video.id, limit - related.length);
      if (video.category_id) {
        // Os da mesma categoria já vieram todos (menos que `limit`): nada se repete.
        fill.andWhere('video.category_id IS DISTINCT FROM :categoryId', {
          categoryId: video.category_id,
        });
      }
      related.push(...(await fill.getMany()));
    }
    return {
      items: related.map((item) => this.toCardItem(item, item.channel)),
    };
  }

  private relatedCandidates(
    excludeId: string,
    limit: number,
  ): SelectQueryBuilder<Video> {
    return this.videos()
      .innerJoinAndSelect('video.channel', 'channel')
      .where("video.status = 'published'")
      .andWhere("video.visibility = 'public'")
      .andWhere("video.processing_status = 'ready'")
      .andWhere('video.published_at IS NOT NULL')
      .andWhere('video.id <> :excludeId', { excludeId })
      .orderBy('video.published_at', 'DESC')
      .addOrderBy('video.id', 'DESC')
      .take(limit);
  }

  private videos(): SelectQueryBuilder<Video> {
    return this.dataSource.getRepository(Video).createQueryBuilder('video');
  }

  private async page(
    qb: SelectQueryBuilder<Video>,
    sortName: string,
    spec: SortSpec,
    query: { limit: number; cursor?: string },
  ): Promise<{ videos: Video[]; nextCursor: string | null }> {
    const column = `video.${spec.column}`;
    if (query.cursor) {
      const position = decodeCursor(query.cursor, sortName);
      const operator = spec.direction === 'DESC' ? '<' : '>';
      qb.andWhere(
        `(${column}, video.id) ${operator} (CAST(:cursorValue AS ${spec.cast}), CAST(:cursorId AS uuid))`,
        { cursorValue: position.value, cursorId: position.id },
      );
    }
    qb.addSelect(`${column}::text`, 'sort_value')
      .orderBy(column, spec.direction)
      .addOrderBy('video.id', spec.direction)
      .limit(query.limit + 1);

    // Sem joins que multipliquem linhas (só 1:1): cada linha crua corresponde a uma entidade.
    const { entities, raw } = await qb.getRawAndEntities<{
      sort_value: string;
    }>();
    const videos = entities.slice(0, query.limit);
    if (entities.length <= query.limit) {
      return { videos, nextCursor: null };
    }
    const last = videos[videos.length - 1];
    return {
      videos,
      nextCursor: encodeCursor({
        sort: sortName,
        value: raw[videos.length - 1].sort_value,
        id: last.id,
      }),
    };
  }

  private toListItem(video: Video): VideoListItem {
    return {
      public_id: video.public_id,
      title: video.title,
      status: video.status,
      visibility: video.visibility,
      processing_status: video.processing_status,
      processing_error: video.processing_error,
      thumbnail_url: this.videosService.thumbnailUrl(video),
      duration_seconds: video.duration_seconds,
      view_count: video.view_count,
      like_count: video.like_count,
      comment_count: video.comment_count,
      published_at: video.published_at
        ? video.published_at.toISOString()
        : null,
      created_at: video.created_at.toISOString(),
    };
  }

  private toCardItem(
    video: Video,
    channel: Pick<Channel, 'nickname' | 'name'>,
  ): VideoCardItem {
    return {
      public_id: video.public_id,
      title: video.title,
      thumbnail_url: this.videosService.thumbnailUrl(video),
      duration_seconds: video.duration_seconds,
      view_count: video.view_count,
      published_at: video.published_at
        ? video.published_at.toISOString()
        : null,
      channel: { nickname: channel.nickname, name: channel.name },
    };
  }
}
