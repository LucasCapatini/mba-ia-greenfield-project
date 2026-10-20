import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import { ChannelNotFoundException } from '../channels/channels.exceptions';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import type { SubscribedChannelsPage } from './dto/subscribed-channels-page.dto';
import type { SubscriptionStateResponse } from './dto/subscription-state-response.dto';
import { Subscription } from './entities/subscription.entity';
import { CannotSubscribeOwnChannelException } from './subscriptions.exceptions';

/** Nome da ordenação gravado no cursor de `GET /me/subscriptions`. */
const CHANNELS_CURSOR_SORT = 'name';

/**
 * Inscrições em canais (social-interactions/TD-02, TD-03, TD-08). Escritas set-state idempotentes:
 * a linha de `subscriptions` e `channels.subscriber_count` mudam na mesma transação, e o contador
 * só se move quando a linha de fato entra (`INSERT … ON CONFLICT DO NOTHING RETURNING`) ou sai
 * (`DELETE … RETURNING`). O canal é lido pelo próprio repositório (sem importar o ChannelsModule),
 * para o ChannelsModule/VideosModule poderem importar este módulo sem ciclo (SI-06.4).
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Channel)
    private readonly channels: Repository<Channel>,
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
  ) {}

  /**
   * `viewer_subscribed` das leituras públicas (social-interactions/TD-04): consulta pela PK;
   * anônimo → `false`.
   */
  async isSubscribed(
    userId: string | undefined,
    channelId: string,
  ): Promise<boolean> {
    if (!userId) return false;
    return this.subscriptions.existsBy({
      user_id: userId,
      channel_id: channelId,
    });
  }

  async subscribe(
    userId: string,
    nickname: string,
  ): Promise<SubscriptionStateResponse> {
    const channel = await this.findChannel(nickname);
    if (channel.user_id === userId) {
      throw new CannotSubscribeOwnChannelException();
    }

    return this.dataSource.transaction(async (manager) => {
      const inserted = await manager
        .createQueryBuilder()
        .insert()
        .into(Subscription)
        .values({ user_id: userId, channel_id: channel.id })
        .orIgnore()
        .returning(['user_id'])
        .execute();
      if ((inserted.raw as unknown[]).length > 0) {
        await this.moveCounter(manager, channel.id, 1);
      }
      return {
        subscribed: true,
        subscriber_count: await this.readCounter(manager, channel.id),
      };
    });
  }

  async unsubscribe(
    userId: string,
    nickname: string,
  ): Promise<SubscriptionStateResponse> {
    const channel = await this.findChannel(nickname);

    return this.dataSource.transaction(async (manager) => {
      const deleted = await manager
        .createQueryBuilder()
        .delete()
        .from(Subscription)
        .where({ user_id: userId, channel_id: channel.id })
        .returning(['user_id'])
        .execute();
      if ((deleted.raw as unknown[]).length > 0) {
        await this.moveCounter(manager, channel.id, -1);
      }
      return {
        subscribed: false,
        subscriber_count: await this.readCounter(manager, channel.id),
      };
    });
  }

  /**
   * Canais seguidos pelo usuário (social-interactions/TD-08, Revisions 2026-10-20): ordem
   * alfabética do nome com desempate por id, em keyset — o menu lateral pede os 7 primeiros e
   * pagina o resto. A comparação da tupla usa a mesma collation do `ORDER BY`.
   */
  async listChannels(
    userId: string,
    query: { cursor?: string; limit: number },
  ): Promise<SubscribedChannelsPage> {
    const qb = this.channels
      .createQueryBuilder('channel')
      .innerJoin(
        Subscription,
        'subscription',
        'subscription.channel_id = channel.id AND subscription.user_id = :userId',
        { userId },
      );
    if (query.cursor) {
      const position = decodeCursor(query.cursor, CHANNELS_CURSOR_SORT);
      qb.andWhere(
        '(channel.name, channel.id) > (:cursorName, CAST(:cursorId AS uuid))',
        { cursorName: position.value, cursorId: position.id },
      );
    }
    const channels = await qb
      .orderBy('channel.name', 'ASC')
      .addOrderBy('channel.id', 'ASC')
      .limit(query.limit + 1)
      .getMany();

    const page = channels.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      items: page.map((channel) => ({
        nickname: channel.nickname,
        name: channel.name,
      })),
      next_cursor:
        channels.length > query.limit
          ? encodeCursor({
              sort: CHANNELS_CURSOR_SORT,
              value: last.name,
              id: last.id,
            })
          : null,
    };
  }

  private async findChannel(nickname: string): Promise<Channel> {
    const channel = await this.channels.findOneBy({ nickname });
    if (!channel) throw new ChannelNotFoundException();
    return channel;
  }

  // SQL direto, como nas reações: o contador muda sem mexer no `updated_at` do canal.
  private async moveCounter(
    manager: EntityManager,
    channelId: string,
    delta: number,
  ): Promise<void> {
    await manager.query(
      'UPDATE "channels" SET "subscriber_count" = "subscriber_count" + $1 WHERE "id" = $2',
      [delta, channelId],
    );
  }

  private async readCounter(
    manager: EntityManager,
    channelId: string,
  ): Promise<number> {
    const [row] = await manager.query<{ subscriber_count: number }[]>(
      'SELECT "subscriber_count" FROM "channels" WHERE "id" = $1',
      [channelId],
    );
    return row.subscriber_count;
  }
}
