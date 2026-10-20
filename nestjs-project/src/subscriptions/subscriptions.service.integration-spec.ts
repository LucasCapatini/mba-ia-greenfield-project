import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import { seedUserWithChannel } from '../test/social-fixtures';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionsModule } from './subscriptions.module';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService (integration)', () => {
  let dataSource: DataSource;
  let service: SubscriptionsService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(createTestDataSource(ALL_ENTITIES).options),
        SubscriptionsModule,
      ],
    }).compile();
    service = module.get(SubscriptionsService);
    dataSource = module.get(DataSource);
    close = () => module.close();
  }, 30000);

  afterAll(async () => {
    await cleanAllTables(dataSource);
    await close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  async function stored(channelId: string) {
    const channel = await dataSource
      .getRepository(Channel)
      .findOneByOrFail({ id: channelId });
    const rows = await dataSource
      .getRepository(Subscription)
      .countBy({ channel_id: channelId });
    return { counter: channel.subscriber_count, rows };
  }

  it('should adjust subscriber_count on subscribe and unsubscribe', async () => {
    const { channel } = await seedUserWithChannel(dataSource, 'sub_owner');
    const { user: ana } = await seedUserWithChannel(dataSource, 'sub_ana');
    const { user: bia } = await seedUserWithChannel(dataSource, 'sub_bia');

    await service.subscribe(ana.id, channel.nickname);
    await expect(service.subscribe(bia.id, channel.nickname)).resolves.toEqual({
      subscribed: true,
      subscriber_count: 2,
    });
    expect(await stored(channel.id)).toEqual({ counter: 2, rows: 2 });

    await expect(
      service.unsubscribe(ana.id, channel.nickname),
    ).resolves.toEqual({ subscribed: false, subscriber_count: 1 });
    expect(await stored(channel.id)).toEqual({ counter: 1, rows: 1 });
  });

  it('should keep the counter equal to COUNT(*) under repeated and parallel calls', async () => {
    const { channel } = await seedUserWithChannel(dataSource, 'sub_owner');
    const { user } = await seedUserWithChannel(dataSource, 'sub_fan');

    await Promise.all(
      Array.from({ length: 10 }, () =>
        service.subscribe(user.id, channel.nickname),
      ),
    );
    expect(await stored(channel.id)).toEqual({ counter: 1, rows: 1 });

    await Promise.all(
      Array.from({ length: 10 }, () =>
        service.unsubscribe(user.id, channel.nickname),
      ),
    );
    expect(await stored(channel.id)).toEqual({ counter: 0, rows: 0 });
  });

  it('should not touch the channel updated_at when the counter moves', async () => {
    const { channel } = await seedUserWithChannel(dataSource, 'sub_owner');
    const { user } = await seedUserWithChannel(dataSource, 'sub_fan');

    await service.subscribe(user.id, channel.nickname);

    const after = await dataSource
      .getRepository(Channel)
      .findOneByOrFail({ id: channel.id });
    expect(after.updated_at.getTime()).toBe(channel.updated_at.getTime());
  });

  it('should list followed channels alphabetically with an id tie-break, paging without repeats', async () => {
    const { user: fan } = await seedUserWithChannel(dataSource, 'sub_fan');
    const names = ['Delta', 'alpha', 'Charlie', 'Bravo', 'Bravo'];
    for (const [index, name] of names.entries()) {
      const { channel } = await seedUserWithChannel(dataSource, 'sub_ch', {
        nickname: `sub_ch_${index}`,
        name,
      });
      await service.subscribe(fan.id, channel.nickname);
    }
    const { channel: notFollowed } = await seedUserWithChannel(
      dataSource,
      'sub_other',
      { name: 'Aardvark' },
    );
    const { user: otherFan } = await seedUserWithChannel(
      dataSource,
      'sub_fan2',
    );
    await service.subscribe(otherFan.id, notFollowed.nickname);

    const seen: { nickname: string; name: string }[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await service.listChannels(fan.id, { cursor, limit: 2 });
      pages++;
      seen.push(...page.items);
      cursor = page.next_cursor ?? undefined;
    } while (cursor);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(5);
    expect(new Set(seen.map((item) => item.nickname)).size).toBe(5);
    expect(seen.map((item) => item.name)).not.toContain('Aardvark');
    // A ordem é a do banco (collation): cada nome não vem antes do anterior.
    const [{ ordered }] = await dataSource.query<{ ordered: string[] }[]>(
      'SELECT array_agg(name ORDER BY name, id) AS ordered FROM channels WHERE nickname LIKE $1',
      ['sub_ch_%'],
    );
    expect(seen.map((item) => item.name)).toEqual(ordered);
  });
});
