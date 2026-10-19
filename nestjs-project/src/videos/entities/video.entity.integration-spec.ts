import { DataSource, Repository } from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { Channel } from '../../channels/entities/channel.entity';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../../test/create-test-data-source';
import { User } from '../../users/entities/user.entity';
import { generatePublicId, storageKeys } from '../public-id.util';
import { Video } from './video.entity';

describe('Video entity (integration)', () => {
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let channelRepository: Repository<Channel>;
  let videoRepository: Repository<Video>;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    userRepository = dataSource.getRepository(User);
    channelRepository = dataSource.getRepository(Channel);
    videoRepository = dataSource.getRepository(Video);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  let counter = 0;
  async function createChannel(): Promise<Channel> {
    counter++;
    const user = await userRepository.save(
      userRepository.create({
        email: `video_user_${counter}@example.com`,
        password: 'hashed',
      }),
    );
    return channelRepository.save(
      channelRepository.create({
        name: `Channel ${counter}`,
        nickname: `video_chan_${counter}`,
        user_id: user.id,
      }),
    );
  }

  function draft(channel: Channel, publicId = generatePublicId()): Video {
    return videoRepository.create({
      public_id: publicId,
      channel_id: channel.id,
      original_filename: 'a.mp4',
      content_type: 'video/mp4',
      size_bytes: 15728640,
      storage_key: storageKeys(publicId).source,
    });
  }

  it('should persist a draft with the default state axes without the caller setting them', async () => {
    const channel = await createChannel();

    const saved = await videoRepository.save(draft(channel));
    const found = await videoRepository.findOneByOrFail({ id: saved.id });

    expect(found.status).toBe('draft');
    expect(found.processing_status).toBe('uploading');
    expect(found.processing_error).toBeNull();
    expect(found.size_bytes).toBe(15728640);
    expect(typeof found.size_bytes).toBe('number');
    expect(found.duration_seconds).toBeNull();
    expect(found.thumbnail_key).toBeNull();
    expect(found.created_at).toBeInstanceOf(Date);
  });

  it('should enforce unique public_id', async () => {
    const channel = await createChannel();
    const publicId = generatePublicId();
    await videoRepository.save(draft(channel, publicId));

    await expect(
      videoRepository.save(draft(channel, publicId)),
    ).rejects.toThrow();
  });

  it('should enforce the channel_id foreign key', async () => {
    const channel = await createChannel();
    const video = draft(channel);
    video.channel_id = '00000000-0000-0000-0000-000000000000';

    await expect(videoRepository.save(video)).rejects.toThrow();
  });

  it('should round-trip numeric metadata written by the worker (bigint/numeric as numbers)', async () => {
    const channel = await createChannel();
    const saved = await videoRepository.save(draft(channel));

    await videoRepository.update(
      { id: saved.id },
      {
        processing_status: 'ready',
        duration_seconds: 2.04,
        width: 320,
        height: 240,
        container: 'mp4',
        video_codec: 'h264',
        audio_codec: null,
        size_bytes: 10737418240,
        processed_at: new Date(),
      },
    );
    const found = await videoRepository.findOneByOrFail({ id: saved.id });

    expect(found.processing_status).toBe('ready');
    expect(found.duration_seconds).toBe(2.04);
    expect(found.size_bytes).toBe(10737418240);
    expect(found.audio_codec).toBeNull();
    expect(found.processed_at).toBeInstanceOf(Date);
  });

  it('should load videos from the channel side of the relation', async () => {
    const channel = await createChannel();
    await videoRepository.save(draft(channel));
    await videoRepository.save(draft(channel));

    const found = await channelRepository.findOne({
      where: { id: channel.id },
      relations: ['videos'],
    });

    expect(found?.videos).toHaveLength(2);
    expect(
      found?.videos.every((video) => video.channel_id === channel.id),
    ).toBe(true);
  });
  describe('publishing columns (Fase 04)', () => {
    let categoryRepository: Repository<Category>;

    beforeAll(() => {
      categoryRepository = dataSource.getRepository(Category);
    });

    afterEach(async () => {
      await dataSource.query(
        `DELETE FROM "categories" WHERE "slug" LIKE 'test-%'`,
      );
    });

    it('should default status, visibility, counters and the editorial fields', async () => {
      const channel = await createChannel();

      const saved = await videoRepository.save(draft(channel));
      const found = await videoRepository.findOneByOrFail({ id: saved.id });

      expect(found.status).toBe('draft');
      expect(found.visibility).toBe('public');
      expect(found.title).toBe('');
      expect(found.description).toBeNull();
      expect(found.category_id).toBeNull();
      expect(found.published_at).toBeNull();
      expect(found.custom_thumbnail_key).toBeNull();
      expect(found.view_count).toBe(0);
      expect(found.like_count).toBe(0);
      expect(found.dislike_count).toBe(0);
      expect(found.comment_count).toBe(0);
    });

    it('should reject a title longer than 100 characters', async () => {
      const channel = await createChannel();
      const video = draft(channel);
      video.title = 't'.repeat(101);

      await expect(videoRepository.save(video)).rejects.toThrow();
    });

    it('should load the category relation', async () => {
      const channel = await createChannel();
      const category = await categoryRepository.save(
        categoryRepository.create({
          slug: 'test-docs',
          name: 'Docs',
          sort_order: 90,
        }),
      );
      const video = draft(channel);
      video.category_id = category.id;
      const saved = await videoRepository.save(video);

      const found = await videoRepository.findOneOrFail({
        where: { id: saved.id },
        relations: ['category'],
      });

      expect(found.category?.slug).toBe('test-docs');
    });

    it('should set category_id to NULL when the category is deleted', async () => {
      const channel = await createChannel();
      const category = await categoryRepository.save(
        categoryRepository.create({
          slug: 'test-gone',
          name: 'Gone',
          sort_order: 91,
        }),
      );
      const video = draft(channel);
      video.category_id = category.id;
      const saved = await videoRepository.save(video);

      await categoryRepository.delete({ id: category.id });

      const found = await videoRepository.findOneByOrFail({ id: saved.id });
      expect(found.category_id).toBeNull();
    });

    it('should reject an unknown category_id', async () => {
      const channel = await createChannel();
      const video = draft(channel);
      video.category_id = '00000000-0000-4000-8000-000000000000';

      await expect(videoRepository.save(video)).rejects.toThrow(/foreign key/i);
    });
  });
});
