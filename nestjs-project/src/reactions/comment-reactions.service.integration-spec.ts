import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Comment } from '../comments/entities/comment.entity';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import {
  seedComment,
  seedUserWithChannel,
  seedVideo,
} from '../test/social-fixtures';
import { CommentReactionsService } from './comment-reactions.service';
import { CommentReaction } from './entities/comment-reaction.entity';
import { ReactionsModule } from './reactions.module';

describe('CommentReactionsService (integration)', () => {
  let dataSource: DataSource;
  let service: CommentReactionsService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(createTestDataSource(ALL_ENTITIES).options),
        ReactionsModule,
      ],
    }).compile();
    service = module.get(CommentReactionsService);
    dataSource = module.get(DataSource);
    close = () => module.close();
  }, 30000);

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  async function setup() {
    const { channel, user: author } = await seedUserWithChannel(
      dataSource,
      'crs_owner',
    );
    const { user } = await seedUserWithChannel(dataSource, 'crs_viewer');
    const video = await seedVideo(dataSource, channel);
    const root = await seedComment(dataSource, video, author);
    const reply = await seedComment(dataSource, video, author, {
      parent_id: root.id,
    });
    return { user, root, reply };
  }

  async function counters(commentId: string) {
    const comment = await dataSource
      .getRepository(Comment)
      .findOneByOrFail({ id: commentId });
    return { like: comment.like_count, dislike: comment.dislike_count };
  }

  it('should keep the comment counters right across like → dislike → removal', async () => {
    const { user, root } = await setup();

    await service.set(root.id, user.id, 'like');
    expect(await counters(root.id)).toEqual({ like: 1, dislike: 0 });

    await service.set(root.id, user.id, 'dislike');
    expect(await counters(root.id)).toEqual({ like: 0, dislike: 1 });

    await expect(service.remove(root.id, user.id)).resolves.toEqual({
      viewer_reaction: null,
      like_count: 0,
      dislike_count: 0,
    });
    expect(await dataSource.getRepository(CommentReaction).count()).toBe(0);
  });

  it('should end with counter == COUNT(*) after 10 parallel sets by the same user', async () => {
    const { user, root } = await setup();

    await Promise.all(
      Array.from({ length: 10 }, () => service.set(root.id, user.id, 'like')),
    );

    const rows = await dataSource
      .getRepository(CommentReaction)
      .countBy({ comment_id: root.id, value: 'like' });
    expect(rows).toBe(1);
    expect(await counters(root.id)).toEqual({ like: rows, dislike: 0 });
  });

  it('should react to a reply the same way as to a root', async () => {
    const { user, root, reply } = await setup();

    await expect(service.set(reply.id, user.id, 'like')).resolves.toEqual({
      viewer_reaction: 'like',
      like_count: 1,
      dislike_count: 0,
    });
    expect(await counters(root.id)).toEqual({ like: 0, dislike: 0 });
    await expect(
      service.findViewerReactions([root.id, reply.id], user.id),
    ).resolves.toEqual(new Map([[reply.id, 'like']]));
  });
});
