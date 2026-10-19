import { DataSource, Repository } from 'typeorm';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import { User } from '../users/entities/user.entity';
import { Video } from '../videos/entities/video.entity';
import { NICKNAME_PATTERN, RESERVED_NICKNAMES } from './channels.constants';
import { ChannelsService } from './channels.service';
import { Channel } from './entities/channel.entity';

describe('ChannelsService (integration)', () => {
  let dataSource: DataSource;
  let channelsService: ChannelsService;
  let userRepository: Repository<User>;
  let channelRepository: Repository<Channel>;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    userRepository = dataSource.getRepository(User);
    channelRepository = dataSource.getRepository(Channel);
    channelsService = new ChannelsService(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  let userCounter = 0;
  async function createUser(): Promise<User> {
    return userRepository.save(
      userRepository.create({
        email: `ch_svc_${++userCounter}@example.com`,
        password: 'hashed',
      }),
    );
  }

  describe('createChannel', () => {
    it('persists a channel derived from email', async () => {
      const user = await createUser();

      const channel = await channelsService.createChannel(
        user.id,
        'mynick@example.com',
      );

      expect(channel.id).toBeDefined();
      expect(channel.nickname).toBe('mynick');
      expect(channel.name).toBe('mynick');
      expect(channel.user_id).toBe(user.id);

      const persisted = await channelRepository.findOneBy({ user_id: user.id });
      expect(persisted).not.toBeNull();
      expect(persisted!.nickname).toBe('mynick');
    });

    it('derives nickname from email prefix', async () => {
      const user = await createUser();

      const channel = await channelsService.createChannel(
        user.id,
        'John.Doe+tag@example.com',
      );

      expect(channel.nickname).toBe('johndoetag');
    });

    it('resolves nickname collision by appending a suffix', async () => {
      const user1 = await createUser();
      const user2 = await createUser();

      await channelsService.createChannel(user1.id, 'shared@example.com');
      const channel2 = await channelsService.createChannel(
        user2.id,
        'shared@example.com',
      );

      expect(channel2.nickname).toMatch(/^shared_[a-z0-9]{3}$/);

      const channels = await channelRepository.find();
      expect(channels).toHaveLength(2);
    });
  });
  describe('createChannel — reserved or short e-mail prefixes', () => {
    it.each(['admin', 'me', 'ab'])(
      'persists a valid, non-reserved nickname for the prefix "%s"',
      async (prefix) => {
        const user = await createUser();

        const channel = await channelsService.createChannel(
          user.id,
          `${prefix}@example.com`,
        );

        expect(channel.nickname).toMatch(new RegExp(`^${prefix}_[0-9a-f]{3}$`));
        expect(channel.nickname).toMatch(NICKNAME_PATTERN);
        expect(RESERVED_NICKNAMES).not.toContain(channel.nickname);
        const persisted = await channelRepository.findOneByOrFail({
          user_id: user.id,
        });
        expect(persisted.nickname).toBe(channel.nickname);
      },
    );

    it('gives distinct nicknames to two sign-ups whose prefix is "admin"', async () => {
      const user1 = await createUser();
      const user2 = await createUser();

      const first = await channelsService.createChannel(
        user1.id,
        'admin@example.com',
      );
      const second = await channelsService.createChannel(
        user2.id,
        'admin@other.example.com',
      );

      expect(first.nickname).toMatch(/^admin_[0-9a-f]{3}$/);
      expect(second.nickname).toMatch(/^admin_[0-9a-f]{3}$/);
      expect(second.nickname).not.toBe(first.nickname);
    });
  });

  describe('updateChannel / countPublicVideos (Fase 04)', () => {
    it('should free the old nickname immediately when the nickname changes', async () => {
      const userA = await createUser();
      const userB = await createUser();
      await channelsService.createChannel(userA.id, 'canal_a@example.com');
      await channelsService.createChannel(userB.id, 'canal_b@example.com');

      const updated = await channelsService.updateChannel(userA.id, {
        nickname: 'novo_nick',
        description: 'Sobre o canal',
      });

      expect(updated.nickname).toBe('novo_nick');
      expect(updated.description).toBe('Sobre o canal');
      await expect(
        channelsService.findByNickname('canal_a'),
      ).resolves.toBeNull();

      const claimed = await channelsService.updateChannel(userB.id, {
        nickname: 'canal_a',
      });
      expect(claimed.nickname).toBe('canal_a');
    });

    it('should refuse a nickname that belongs to another channel', async () => {
      const userA = await createUser();
      const userB = await createUser();
      await channelsService.createChannel(userA.id, 'canal_a@example.com');
      await channelsService.createChannel(userB.id, 'canal_b@example.com');

      await expect(
        channelsService.updateChannel(userA.id, { nickname: 'canal_b' }),
      ).rejects.toMatchObject({ errorCode: 'NICKNAME_TAKEN' });
      await expect(
        channelsService.findByNickname('canal_a'),
      ).resolves.not.toBeNull();
    });

    it('should count only published + public videos', async () => {
      const user = await createUser();
      const channel = await channelsService.createChannel(
        user.id,
        'contador@example.com',
      );
      const videoRepository = dataSource.getRepository(Video);
      const seeds: Array<[Video['status'], Video['visibility']]> = [
        ['published', 'public'],
        ['published', 'public'],
        ['published', 'unlisted'],
        ['draft', 'public'],
      ];
      for (const [index, [status, visibility]] of seeds.entries()) {
        await videoRepository.save(
          videoRepository.create({
            public_id: `countVid00${index}`,
            channel_id: channel.id,
            original_filename: 'a.mp4',
            content_type: 'video/mp4',
            storage_key: `videos/countVid00${index}/source`,
            status,
            visibility,
          }),
        );
      }

      await expect(channelsService.countPublicVideos(channel.id)).resolves.toBe(
        2,
      );
      const own = await channelsService.getOwnChannel(user.id);
      expect(own.video_count).toBe(2);
      const publicView = await channelsService.getPublicChannel('contador');
      expect(publicView.video_count).toBe(2);
      expect(Object.keys(publicView).sort()).toEqual([
        'created_at',
        'description',
        'name',
        'nickname',
        'video_count',
      ]);
    });
  });
});
