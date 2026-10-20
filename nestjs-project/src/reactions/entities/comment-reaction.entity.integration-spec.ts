import { DataSource, Repository } from 'typeorm';
import { Comment } from '../../comments/entities/comment.entity';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../../test/create-test-data-source';
import { seedUserWithChannel, seedVideo } from '../../test/social-fixtures';
import { CommentReaction } from './comment-reaction.entity';

describe('CommentReaction entity (integration)', () => {
  let dataSource: DataSource;
  let reactions: Repository<CommentReaction>;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    reactions = dataSource.getRepository(CommentReaction);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  async function setup() {
    const { user, channel } = await seedUserWithChannel(dataSource, 'cr');
    const video = await seedVideo(dataSource, channel);
    const comments = dataSource.getRepository(Comment);
    const comment = await comments.save(
      comments.create({ video_id: video.id, user_id: user.id, text: 'Olá' }),
    );
    return { user, comment };
  }

  it('rejects a second reaction of the same user to the same comment (composite PK)', async () => {
    const { user, comment } = await setup();
    await reactions.insert({
      user_id: user.id,
      comment_id: comment.id,
      value: 'like',
    });

    await expect(
      reactions.insert({
        user_id: user.id,
        comment_id: comment.id,
        value: 'dislike',
      }),
    ).rejects.toThrow(/PK_comment_reactions/);
  });

  it('is deleted together with the comment', async () => {
    const { user, comment } = await setup();
    await reactions.insert({
      user_id: user.id,
      comment_id: comment.id,
      value: 'dislike',
    });

    await dataSource.getRepository(Comment).delete({ id: comment.id });

    expect(await reactions.count()).toBe(0);
  });
});
