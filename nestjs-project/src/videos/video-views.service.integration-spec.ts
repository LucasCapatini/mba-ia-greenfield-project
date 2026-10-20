import type { ConfigType } from '@nestjs/config';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { createChannelsService } from '../test/channels-service';
import { Channel } from '../channels/entities/channel.entity';
import type authConfig from '../config/auth.config';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import { User } from '../users/entities/user.entity';
import { VideoView } from './entities/video-view.entity';
import { Video } from './entities/video.entity';
import { generatePublicId, storageKeys } from './public-id.util';
import { VideoViewsService, type Viewer } from './video-views.service';

const NOW = new Date('2026-10-19T12:00:00.000Z');
const ANON: Viewer = { ip: '203.0.113.10', userAgent: 'e2e-agent' };

describe('VideoViewsService (integration — DB real)', () => {
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let viewRepository: Repository<VideoView>;
  let service: VideoViewsService;
  let ownerId: string;
  let video: Video;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    videoRepository = dataSource.getRepository(Video);
    viewRepository = dataSource.getRepository(VideoView);
    service = new VideoViewsService(
      dataSource,
      createChannelsService(dataSource),
      {
        jwtSecret: 'integration-secret',
      } as ConfigType<typeof authConfig>,
    );
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    const users = dataSource.getRepository(User);
    const channels = dataSource.getRepository(Channel);
    const owner = await users.save(
      users.create({ email: 'views-owner@example.com', password: 'hashed' }),
    );
    ownerId = owner.id;
    const channel = await channels.save(
      channels.create({
        name: 'Owner',
        nickname: 'views_owner',
        user_id: owner.id,
      }),
    );
    const publicId = generatePublicId();
    video = await videoRepository.save(
      videoRepository.create({
        public_id: publicId,
        channel_id: channel.id,
        original_filename: 'a.mp4',
        content_type: 'video/mp4',
        size_bytes: 1024,
        storage_key: storageKeys(publicId).source,
        status: 'published',
        processing_status: 'ready',
        published_at: NOW,
      }),
    );
  });

  async function viewCount(): Promise<number> {
    const row = await videoRepository.findOneByOrFail({ id: video.id });
    return row.view_count;
  }

  async function createUser(email: string): Promise<string> {
    const users = dataSource.getRepository(User);
    const user = await users.save(users.create({ email, password: 'hashed' }));
    return user.id;
  }

  it('should count the same anonymous viewer once per UTC day', async () => {
    await expect(service.record(video, ANON, NOW)).resolves.toBe(true);
    await expect(service.record(video, ANON, NOW)).resolves.toBe(false);

    expect(await viewCount()).toBe(1);
    expect(await viewRepository.countBy({ video_id: video.id })).toBe(1);

    const nextDay = new Date('2026-10-20T00:30:00.000Z');
    await expect(service.record(video, ANON, nextDay)).resolves.toBe(true);
    expect(await viewCount()).toBe(2);
  });

  it('should count two authenticated users separately', async () => {
    const ana = await createUser('ana@example.com');
    const bia = await createUser('bia@example.com');

    await service.record(video, { ...ANON, userId: ana }, NOW);
    await service.record(video, { ...ANON, userId: bia }, NOW);

    expect(await viewCount()).toBe(2);
    const keys = (await viewRepository.findBy({ video_id: video.id }))
      .map((row) => row.viewer_key)
      .sort();
    expect(keys).toEqual([`user:${ana}`, `user:${bia}`].sort());
  });

  it('should never count the channel owner', async () => {
    await expect(
      service.record(video, { ...ANON, userId: ownerId }, NOW),
    ).resolves.toBe(false);

    expect(await viewCount()).toBe(0);
    expect(await viewRepository.countBy({ video_id: video.id })).toBe(0);
  });

  it('should leave neither the view nor the counter when the increment fails', async () => {
    const increment = jest
      .spyOn(EntityManager.prototype, 'increment')
      .mockRejectedValueOnce(new Error('increment failed'));

    await expect(service.record(video, ANON, NOW)).rejects.toThrow(
      'increment failed',
    );

    increment.mockRestore();
    expect(await viewCount()).toBe(0);
    expect(await viewRepository.countBy({ video_id: video.id })).toBe(0);
  });
});
