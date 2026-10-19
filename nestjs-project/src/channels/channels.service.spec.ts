import { DataSource, QueryFailedError } from 'typeorm';
import {
  ChannelNotFoundException,
  NicknameTakenException,
} from './channels.exceptions';
import { ChannelsService } from './channels.service';
import { Channel } from './entities/channel.entity';

type ManagerMock = {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

function makeManager(overrides: Partial<ManagerMock> = {}): ManagerMock {
  return {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    ...overrides,
  };
}

function makeChannel(nickname: string): Channel {
  const c = new Channel();
  c.id = 'uuid';
  c.nickname = nickname;
  c.name = nickname;
  c.user_id = 'user-id';
  c.description = null;
  c.created_at = new Date();
  c.updated_at = new Date();
  return c;
}

function makeUniqueError(): QueryFailedError {
  const err = new QueryFailedError(
    'INSERT',
    [],
    new Error(),
  ) as QueryFailedError & {
    code: string;
    detail: string;
  };
  err.code = '23505';
  err.detail = 'Key (nickname)=(abc) already exists.';
  return err;
}

function makeDataSource(manager: ManagerMock): DataSource {
  return {
    transaction: jest.fn((cb: (m: ManagerMock) => Promise<unknown>) =>
      cb(manager),
    ),
  } as unknown as DataSource;
}

describe('ChannelsService', () => {
  describe('createChannel', () => {
    it('derives nickname from email prefix and saves when no collision', async () => {
      const channel = makeChannel('test');
      const manager = makeManager({
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(channel),
        save: jest.fn().mockResolvedValue(channel),
      });
      const service = new ChannelsService(makeDataSource(manager));

      const result = await service.createChannel('user-id', 'test@example.com');

      expect(manager.findOne).toHaveBeenCalledWith(Channel, {
        where: { nickname: 'test' },
      });
      expect(manager.save).toHaveBeenCalledTimes(1);
      expect(result.nickname).toBe('test');
    });

    it('retries with suffix when pre-check finds existing nickname', async () => {
      const colliding = makeChannel('john');
      const resolved = makeChannel('john_abc');
      const manager = makeManager({
        findOne: jest
          .fn()
          .mockResolvedValueOnce(colliding)
          .mockResolvedValueOnce(null),
        create: jest.fn().mockReturnValue(resolved),
        save: jest.fn().mockResolvedValue(resolved),
      });
      const service = new ChannelsService(makeDataSource(manager));

      const result = await service.createChannel('user-id', 'john@example.com');

      expect(manager.findOne).toHaveBeenCalledTimes(2);
      expect(manager.save).toHaveBeenCalledTimes(1);
      expect(result.nickname).toMatch(/^john_[a-z0-9]{3}$/);
    });

    it('retries with suffix on concurrent unique constraint violation', async () => {
      const resolved = makeChannel('alice_abc');
      const manager = makeManager({
        findOne: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        create: jest.fn().mockReturnValue(resolved),
        save: jest
          .fn()
          .mockRejectedValueOnce(makeUniqueError())
          .mockResolvedValueOnce(resolved),
      });
      const service = new ChannelsService(makeDataSource(manager));

      const result = await service.createChannel(
        'user-id',
        'alice@example.com',
      );

      expect(manager.save).toHaveBeenCalledTimes(2);
      expect(result.nickname).toMatch(/^alice/);
    });

    it('throws after exhausting max retries', async () => {
      const existing = makeChannel('bob');
      const manager = makeManager({
        findOne: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
        save: jest.fn(),
      });
      const service = new ChannelsService(makeDataSource(manager));

      await expect(
        service.createChannel('user-id', 'bob@example.com'),
      ).rejects.toThrow(
        'Nickname conflict could not be resolved after max retries',
      );
    });

    it('re-throws non-unique-constraint errors immediately', async () => {
      const unexpectedError = new Error('Connection lost');
      const channel = makeChannel('carol');
      const manager = makeManager({
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(channel),
        save: jest.fn().mockRejectedValue(unexpectedError),
      });
      const service = new ChannelsService(makeDataSource(manager));

      await expect(
        service.createChannel('user-id', 'carol@example.com'),
      ).rejects.toThrow('Connection lost');
      expect(manager.save).toHaveBeenCalledTimes(1);
    });

    it.each(['admin', 'me', 'ab'])(
      'starts from a suffixed nickname when the prefix "%s" is reserved or shorter than 3 chars',
      async (prefix) => {
        const manager = makeManager({
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn((_entity: unknown, data: Partial<Channel>) => data),
          save: jest.fn((data: Partial<Channel>) => Promise.resolve(data)),
        });
        const service = new ChannelsService(makeDataSource(manager));

        const result = await service.createChannel(
          'user-id',
          `${prefix}@example.com`,
        );

        const suffixed = new RegExp(`^${prefix}_[0-9a-f]{3}$`);
        expect(result.nickname).toMatch(suffixed);
        expect(result.name).toBe(prefix);
        expect(manager.findOne).toHaveBeenCalledTimes(1);
        expect(manager.findOne).toHaveBeenCalledWith(Channel, {
          where: { nickname: expect.stringMatching(suffixed) as string },
        });
      },
    );
  });
  describe('updateChannel', () => {
    function setup(owned: Channel, holder: Channel | null = null) {
      const channelRepo = {
        findOne: jest.fn((options: { where: Record<string, string> }) =>
          Promise.resolve(
            options.where.user_id
              ? owned
              : options.where.nickname
                ? holder
                : null,
          ),
        ),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOneByOrFail: jest.fn(() => Promise.resolve(owned)),
      };
      const videoRepo = { count: jest.fn().mockResolvedValue(3) };
      const dataSource = {
        getRepository: jest.fn((entity: unknown) =>
          entity === Channel ? channelRepo : videoRepo,
        ),
      };
      return {
        service: new ChannelsService(dataSource as unknown as DataSource),
        channelRepo,
        videoRepo,
      };
    }

    it('should update only the fields sent and return the channel with its public video count', async () => {
      const owned = makeChannel('canal_a');
      const { service, channelRepo, videoRepo } = setup(owned);

      const result = await service.updateChannel('user-id', {
        name: 'Canal Novo',
      });

      expect(channelRepo.update).toHaveBeenCalledWith('uuid', {
        name: 'Canal Novo',
      });
      expect(videoRepo.count).toHaveBeenCalledWith({
        where: {
          channel_id: 'uuid',
          status: 'published',
          visibility: 'public',
        },
      });
      expect(result.video_count).toBe(3);
    });

    it('should reject a nickname held by another channel with NICKNAME_TAKEN before writing', async () => {
      const owned = makeChannel('canal_a');
      const other = makeChannel('canal_b');
      other.id = 'other-uuid';
      const { service, channelRepo } = setup(owned, other);

      const promise = service.updateChannel('user-id', { nickname: 'canal_b' });

      await expect(promise).rejects.toBeInstanceOf(NicknameTakenException);
      await expect(promise).rejects.toMatchObject({
        httpStatus: 409,
        errorCode: 'NICKNAME_TAKEN',
      });
      expect(channelRepo.update).not.toHaveBeenCalled();
    });

    it('should map a unique violation raced after the pre-check to NICKNAME_TAKEN', async () => {
      const { service, channelRepo } = setup(makeChannel('canal_a'));
      channelRepo.update.mockRejectedValueOnce(makeUniqueError());

      await expect(
        service.updateChannel('user-id', { nickname: 'disputado' }),
      ).rejects.toBeInstanceOf(NicknameTakenException);
    });

    it('should re-throw any other database error', async () => {
      const { service, channelRepo } = setup(makeChannel('canal_a'));
      channelRepo.update.mockRejectedValueOnce(new Error('Connection lost'));

      await expect(
        service.updateChannel('user-id', { name: 'x' }),
      ).rejects.toThrow('Connection lost');
    });

    it('should skip the write when the nickname sent is the current one', async () => {
      const { service, channelRepo } = setup(makeChannel('canal_a'));

      await service.updateChannel('user-id', { nickname: 'canal_a' });

      expect(channelRepo.findOne).not.toHaveBeenCalledWith({
        where: { nickname: 'canal_a' },
      });
      expect(channelRepo.update).not.toHaveBeenCalled();
    });

    it('should answer CHANNEL_NOT_FOUND when the user has no channel', async () => {
      const { service, channelRepo } = setup(makeChannel('canal_a'));
      channelRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateChannel('user-id', { name: 'x' }),
      ).rejects.toBeInstanceOf(ChannelNotFoundException);
    });
  });
});
