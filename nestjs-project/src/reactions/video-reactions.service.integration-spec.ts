import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import { seedUserWithChannel, seedVideo } from '../test/social-fixtures';
import { Video } from '../videos/entities/video.entity';
import { VideoReaction } from './entities/video-reaction.entity';
import { ReactionsModule } from './reactions.module';
import { VideoReactionsService } from './video-reactions.service';

describe('VideoReactionsService (integration)', () => {
  let dataSource: DataSource;
  let service: VideoReactionsService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(createTestDataSource(ALL_ENTITIES).options),
        ReactionsModule,
      ],
    }).compile();
    service = module.get(VideoReactionsService);
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

  async function setup() {
    const { channel } = await seedUserWithChannel(dataSource, 'vrs_owner');
    const { user } = await seedUserWithChannel(dataSource, 'vrs_viewer');
    const video = await seedVideo(dataSource, channel);
    return { user, video };
  }

  async function counters(videoId: string) {
    const video = await dataSource
      .getRepository(Video)
      .findOneByOrFail({ id: videoId });
    return { like: video.like_count, dislike: video.dislike_count };
  }

  it('should keep the counters right across like → dislike → removal', async () => {
    const { user, video } = await setup();

    await service.set(video.public_id, user.id, 'like');
    expect(await counters(video.id)).toEqual({ like: 1, dislike: 0 });

    await service.set(video.public_id, user.id, 'dislike');
    expect(await counters(video.id)).toEqual({ like: 0, dislike: 1 });

    const state = await service.remove(video.public_id, user.id);
    expect(state).toEqual({
      viewer_reaction: null,
      like_count: 0,
      dislike_count: 0,
    });
    expect(await dataSource.getRepository(VideoReaction).count()).toBe(0);
  });

  it('should end with counters equal to COUNT(*) after 10 parallel sets of the same user', async () => {
    const { user, video } = await setup();

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        service.set(video.public_id, user.id, i % 2 === 0 ? 'like' : 'dislike'),
      ),
    );

    const rows = await dataSource
      .getRepository(VideoReaction)
      .findBy({ video_id: video.id });
    expect(rows).toHaveLength(1);
    const expected = {
      like: rows[0].value === 'like' ? 1 : 0,
      dislike: rows[0].value === 'dislike' ? 1 : 0,
    };
    expect(await counters(video.id)).toEqual(expected);
  });

  it('should count reactions of different users independently', async () => {
    const { user, video } = await setup();
    const { user: other } = await seedUserWithChannel(dataSource, 'vrs_other');

    await Promise.all([
      service.set(video.public_id, user.id, 'like'),
      service.set(video.public_id, other.id, 'like'),
    ]);

    expect(await counters(video.id)).toEqual({ like: 2, dislike: 0 });
  });

  it('should not change the video updated_at (thumbnail URL version)', async () => {
    const { user, video } = await setup();
    const before = (
      await dataSource.getRepository(Video).findOneByOrFail({ id: video.id })
    ).updated_at;

    await service.set(video.public_id, user.id, 'like');

    const after = (
      await dataSource.getRepository(Video).findOneByOrFail({ id: video.id })
    ).updated_at;
    expect(after.getTime()).toBe(before.getTime());
  });

  it('should reject a draft even for its owner', async () => {
    const { channel, user } = await seedUserWithChannel(dataSource, 'vrs_dono');
    const draft = await seedVideo(dataSource, channel, {
      status: 'draft',
      published_at: null,
    });

    await expect(
      service.set(draft.public_id, user.id, 'like'),
    ).rejects.toMatchObject({ errorCode: 'VIDEO_NOT_FOUND' });
  });
});
