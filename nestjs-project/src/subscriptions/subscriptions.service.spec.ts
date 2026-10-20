import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import { ChannelNotFoundException } from '../channels/channels.exceptions';
import { Subscription } from './entities/subscription.entity';
import { CannotSubscribeOwnChannelException } from './subscriptions.exceptions';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>();
  const execute = jest.fn<Promise<{ raw: unknown[] }>, []>();
  // Cadeia do QueryBuilder: cada passo devolve o próprio builder, `execute` encerra.
  const builder: Record<string, jest.Mock> = {};
  for (const step of [
    'insert',
    'into',
    'values',
    'orIgnore',
    'returning',
    'delete',
    'from',
    'where',
  ]) {
    builder[step] = jest.fn(() => builder);
  }
  builder.execute = execute;
  const manager = { query, createQueryBuilder: jest.fn(() => builder) };
  const transaction = jest.fn((cb: (m: typeof manager) => unknown) =>
    cb(manager),
  );
  const findChannel = jest.fn();
  const existsSubscription = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.startsWith('SELECT') ? [{ subscriber_count: 7 }] : [],
      ),
    );
    findChannel.mockResolvedValue({
      id: 'channel-1',
      nickname: 'criador',
      user_id: 'owner-1',
    });

    const module = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: DataSource, useValue: { transaction } },
        {
          provide: getRepositoryToken(Channel),
          useValue: { findOneBy: findChannel },
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: { existsBy: existsSubscription },
        },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
  });

  const counterUpdates = () =>
    query.mock.calls.filter(([sql]) => String(sql).startsWith('UPDATE'));

  it('should refuse a subscription to the own channel before any write', async () => {
    await expect(
      service.subscribe('owner-1', 'criador'),
    ).rejects.toBeInstanceOf(CannotSubscribeOwnChannelException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('should raise CHANNEL_NOT_FOUND for an unknown nickname', async () => {
    findChannel.mockResolvedValue(null);

    await expect(
      service.subscribe('user-1', 'nao_existe'),
    ).rejects.toBeInstanceOf(ChannelNotFoundException);
    await expect(
      service.unsubscribe('user-1', 'nao_existe'),
    ).rejects.toBeInstanceOf(ChannelNotFoundException);
  });

  it('should move the counter only when the subscription row is inserted', async () => {
    execute.mockResolvedValueOnce({ raw: [{ user_id: 'user-1' }] });

    await expect(service.subscribe('user-1', 'criador')).resolves.toEqual({
      subscribed: true,
      subscriber_count: 7,
    });
    expect(counterUpdates()).toEqual([[expect.any(String), [1, 'channel-1']]]);
  });

  it('should not increment when the user is already subscribed', async () => {
    execute.mockResolvedValueOnce({ raw: [] });

    await expect(service.subscribe('user-1', 'criador')).resolves.toEqual({
      subscribed: true,
      subscriber_count: 7,
    });
    expect(counterUpdates()).toHaveLength(0);
  });

  it('should decrement only when a subscription row was deleted', async () => {
    execute.mockResolvedValueOnce({ raw: [{ user_id: 'user-1' }] });
    await service.unsubscribe('user-1', 'criador');
    expect(counterUpdates()).toEqual([[expect.any(String), [-1, 'channel-1']]]);

    query.mockClear();
    execute.mockResolvedValueOnce({ raw: [] });
    await expect(service.unsubscribe('user-1', 'criador')).resolves.toEqual({
      subscribed: false,
      subscriber_count: 7,
    });
    expect(counterUpdates()).toHaveLength(0);
  });

  it('should report an anonymous viewer as not subscribed without querying', async () => {
    await expect(service.isSubscribed(undefined, 'channel-1')).resolves.toBe(
      false,
    );
    expect(existsSubscription).not.toHaveBeenCalled();
  });
});
