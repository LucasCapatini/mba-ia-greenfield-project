import { DataSource, Repository } from 'typeorm';
import { CommentReaction } from '../../reactions/entities/comment-reaction.entity';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../../test/create-test-data-source';
import { seedUserWithChannel, seedVideo } from '../../test/social-fixtures';
import { Video } from '../../videos/entities/video.entity';
import { Comment } from './comment.entity';

describe('Comment entity (integration)', () => {
  let dataSource: DataSource;
  let comments: Repository<Comment>;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    comments = dataSource.getRepository(Comment);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  async function setup() {
    const { user, channel } = await seedUserWithChannel(dataSource, 'cm');
    const video = await seedVideo(dataSource, channel);
    return { user, video };
  }

  it('starts with zeroed counters and no edited_at', async () => {
    const { user, video } = await setup();

    const saved = await comments.save(
      comments.create({ video_id: video.id, user_id: user.id, text: 'Olá' }),
    );
    const found = await comments.findOneByOrFail({ id: saved.id });

    expect(found).toMatchObject({
      parent_id: null,
      like_count: 0,
      dislike_count: 0,
      reply_count: 0,
      edited_at: null,
    });
  });

  it('deleting a root deletes its replies and their reactions', async () => {
    const { user, video } = await setup();
    const root = await comments.save(
      comments.create({ video_id: video.id, user_id: user.id, text: 'raiz' }),
    );
    const reply = await comments.save(
      comments.create({
        video_id: video.id,
        user_id: user.id,
        text: 'resposta',
        parent_id: root.id,
      }),
    );
    await dataSource
      .getRepository(CommentReaction)
      .insert({ user_id: user.id, comment_id: reply.id, value: 'like' });

    await comments.delete({ id: root.id });

    expect(await comments.count()).toBe(0);
    expect(await dataSource.getRepository(CommentReaction).count()).toBe(0);
  });

  it('is deleted together with the video', async () => {
    const { user, video } = await setup();
    await comments.save(
      comments.create({ video_id: video.id, user_id: user.id, text: 'Olá' }),
    );

    await dataSource.getRepository(Video).delete({ id: video.id });

    expect(await comments.count()).toBe(0);
  });
});
