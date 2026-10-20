import { DataSource, Repository } from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../../test/create-test-data-source';
import { seedUserWithChannel } from '../../test/social-fixtures';
import { Subscription } from './subscription.entity';

describe('Subscription entity (integration)', () => {
  let dataSource: DataSource;
  let subscriptions: Repository<Subscription>;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    subscriptions = dataSource.getRepository(Subscription);
  });

  afterAll(async () => {
    await cleanAllTables(dataSource);
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  it('rejects a duplicate subscription (composite PK)', async () => {
    const { channel } = await seedUserWithChannel(dataSource, 'sub_creator');
    const { user } = await seedUserWithChannel(dataSource, 'sub_viewer');
    await subscriptions.insert({ user_id: user.id, channel_id: channel.id });

    await expect(
      subscriptions.insert({ user_id: user.id, channel_id: channel.id }),
    ).rejects.toThrow(/PK_subscriptions/);
  });

  it('is deleted together with the channel', async () => {
    const { channel } = await seedUserWithChannel(dataSource, 'sub_creator');
    const { user } = await seedUserWithChannel(dataSource, 'sub_viewer');
    await subscriptions.insert({ user_id: user.id, channel_id: channel.id });

    await dataSource.getRepository(Channel).delete({ id: channel.id });

    expect(await subscriptions.count()).toBe(0);
  });
});
