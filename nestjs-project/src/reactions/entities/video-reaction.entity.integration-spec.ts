import { DataSource, Repository } from 'typeorm';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../../test/create-test-data-source';
import { seedUserWithChannel, seedVideo } from '../../test/social-fixtures';
import { Video } from '../../videos/entities/video.entity';
import { VideoReaction } from './video-reaction.entity';

describe('VideoReaction entity (integration)', () => {
  let dataSource: DataSource;
  let reactions: Repository<VideoReaction>;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    reactions = dataSource.getRepository(VideoReaction);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  async function setup() {
    const { channel } = await seedUserWithChannel(dataSource, 'vr_owner');
    const { user } = await seedUserWithChannel(dataSource, 'vr_viewer');
    const video = await seedVideo(dataSource, channel);
    return { user, video };
  }

  it('rejects a second reaction of the same user to the same video (composite PK)', async () => {
    const { user, video } = await setup();
    await reactions.insert({
      user_id: user.id,
      video_id: video.id,
      value: 'like',
    });

    await expect(
      reactions.insert({
        user_id: user.id,
        video_id: video.id,
        value: 'dislike',
      }),
    ).rejects.toThrow(/PK_video_reactions/);
  });

  it('rejects a value outside the reaction_value enum', async () => {
    const { user, video } = await setup();

    await expect(
      dataSource.query(
        `INSERT INTO "video_reactions" ("user_id", "video_id", "value") VALUES ($1, $2, 'love')`,
        [user.id, video.id],
      ),
    ).rejects.toThrow(/reaction_value/);
  });

  it('is deleted together with the video (hard delete cascade)', async () => {
    const { user, video } = await setup();
    await reactions.insert({
      user_id: user.id,
      video_id: video.id,
      value: 'like',
    });

    await dataSource.getRepository(Video).delete({ id: video.id });

    expect(await reactions.count()).toBe(0);
  });
});
