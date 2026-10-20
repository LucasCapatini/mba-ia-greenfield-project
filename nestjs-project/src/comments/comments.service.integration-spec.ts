import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CommentReaction } from '../reactions/entities/comment-reaction.entity';
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
import { Video } from '../videos/entities/video.entity';
import { CommentsModule } from './comments.module';
import { CommentsService } from './comments.service';
import type { CommentsPage } from './dto/comment-response.dto';
import { Comment } from './entities/comment.entity';

describe('CommentsService (integration)', () => {
  let dataSource: DataSource;
  let service: CommentsService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(createTestDataSource(ALL_ENTITIES).options),
        CommentsModule,
      ],
    }).compile();
    service = module.get(CommentsService);
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
    const { channel } = await seedUserWithChannel(dataSource, 'cs_owner');
    const { user: ana, channel: anaChannel } = await seedUserWithChannel(
      dataSource,
      'cs_ana',
    );
    const { user: bia } = await seedUserWithChannel(dataSource, 'cs_bia');
    const video = await seedVideo(dataSource, channel);
    return { video, ana, anaChannel, bia };
  }

  async function commentCount(videoId: string) {
    const video = await dataSource
      .getRepository(Video)
      .findOneByOrFail({ id: videoId });
    return video.comment_count;
  }

  /** Percorre todas as páginas seguindo o cursor. */
  async function walk(
    publicId: string,
    sort: 'latest' | 'top',
    limit: number,
    viewerId?: string,
  ) {
    const pages: CommentsPage[] = [];
    let cursor: string | undefined;
    do {
      const page = await service.listRoots(
        publicId,
        { sort, cursor, limit },
        viewerId,
      );
      pages.push(page);
      cursor = page.next_cursor ?? undefined;
    } while (cursor);
    return pages;
  }

  it('should add the comment and increment comment_count in the same write', async () => {
    const { video, ana, anaChannel } = await setup();

    const created = await service.create(video.public_id, ana.id, 'Oi');

    expect(created).toMatchObject({
      text: 'Oi',
      parent_id: null,
      reply_count: 0,
      edited_at: null,
      viewer_reaction: null,
      viewer_is_author: true,
      author: { nickname: anaChannel.nickname, name: anaChannel.name },
    });
    expect(await commentCount(video.id)).toBe(1);
  });

  it('should delete a root with its 2 replies and their reactions, taking 3 from comment_count', async () => {
    const { video, ana, bia } = await setup();
    const root = await service.create(video.public_id, ana.id, 'raiz');
    const replies = await Promise.all(
      [1, 2].map((n) =>
        seedComment(dataSource, video, bia, {
          parent_id: root.id,
          text: `resposta ${n}`,
        }),
      ),
    );
    await dataSource.query(
      'UPDATE "comments" SET "reply_count" = 2 WHERE "id" = $1',
      [root.id],
    );
    await dataSource.query(
      'UPDATE "videos" SET "comment_count" = 3 WHERE "id" = $1',
      [video.id],
    );
    await dataSource
      .getRepository(CommentReaction)
      .save({ user_id: ana.id, comment_id: replies[0].id, value: 'like' });

    await service.remove(root.id, ana.id);

    expect(await dataSource.getRepository(Comment).count()).toBe(0);
    expect(await dataSource.getRepository(CommentReaction).count()).toBe(0);
    expect(await commentCount(video.id)).toBe(0);
  });

  it('should take 1 from the video and from the root when a reply is deleted', async () => {
    const { video, ana, bia } = await setup();
    const root = await seedComment(dataSource, video, ana, { reply_count: 1 });
    const reply = await seedComment(dataSource, video, bia, {
      parent_id: root.id,
    });
    await dataSource.query(
      'UPDATE "videos" SET "comment_count" = 2 WHERE "id" = $1',
      [video.id],
    );

    await service.remove(reply.id, bia.id);

    const storedRoot = await dataSource
      .getRepository(Comment)
      .findOneByOrFail({ id: root.id });
    expect(storedRoot.reply_count).toBe(0);
    expect(await commentCount(video.id)).toBe(1);
  });

  it('should page roots by latest and by top without repeating or skipping', async () => {
    const { video, ana, bia } = await setup();
    const likes = [5, 9, 9, 0, 3, 9, 1, 7, 7, 2, 4];
    const roots: Comment[] = [];
    for (const like_count of likes) {
      roots.push(await seedComment(dataSource, video, ana, { like_count }));
    }
    await seedComment(dataSource, video, bia, { parent_id: roots[0].id });

    const latest = (await walk(video.public_id, 'latest', 4)).flatMap(
      (page) => page.items,
    );
    expect(latest.map((item) => item.id).sort()).toEqual(
      roots.map((root) => root.id).sort(),
    );
    // ISO em ms (o banco ordena em µs): basta a sequência não crescer.
    const latestTimes = latest.map((item) => Date.parse(item.created_at));
    latestTimes.slice(1).forEach((time, index) => {
      expect(time).toBeLessThanOrEqual(latestTimes[index]);
    });

    const topPages = await walk(video.public_id, 'top', 4);
    expect(topPages).toHaveLength(3);
    const top = topPages.flatMap((page) => page.items);
    expect(new Set(top.map((item) => item.id)).size).toBe(likes.length);
    expect(top.every((item) => item.parent_id === null)).toBe(true);
    expect(top.map((item) => item.like_count)).toEqual(
      [...likes].sort((a, b) => b - a),
    );
  });

  it('should fill viewer_reaction and viewer_is_author per viewer', async () => {
    const { video, ana, bia } = await setup();
    const mine = await seedComment(dataSource, video, ana);
    const theirs = await seedComment(dataSource, video, bia);
    await dataSource
      .getRepository(CommentReaction)
      .save({ user_id: ana.id, comment_id: theirs.id, value: 'dislike' });

    const byId = async (viewerId?: string) => {
      const page = await service.listRoots(
        video.public_id,
        { sort: 'latest', limit: 20 },
        viewerId,
      );
      return new Map(page.items.map((item) => [item.id, item]));
    };

    const forAna = await byId(ana.id);
    expect(forAna.get(mine.id)).toMatchObject({
      viewer_is_author: true,
      viewer_reaction: null,
    });
    expect(forAna.get(theirs.id)).toMatchObject({
      viewer_is_author: false,
      viewer_reaction: 'dislike',
    });

    const anonymous = await byId();
    for (const item of anonymous.values()) {
      expect(item).toMatchObject({
        viewer_is_author: false,
        viewer_reaction: null,
      });
    }
  });

  it('should record edited_at when the author edits', async () => {
    const { video, ana } = await setup();
    const created = await service.create(video.public_id, ana.id, 'antes');

    const edited = await service.update(created.id, ana.id, 'depois');

    expect(edited.text).toBe('depois');
    expect(edited.edited_at).not.toBeNull();
  });

  it('should attach a reply to a reply under its root and bump both counters', async () => {
    const { video, ana, bia } = await setup();
    const root = await service.create(video.public_id, ana.id, 'raiz');

    const first = await service.reply(root.id, bia.id, 'Concordo');
    const second = await service.reply(first.id, ana.id, '@bia obrigado');

    expect(first.parent_id).toBe(root.id);
    expect(second.parent_id).toBe(root.id);
    const storedRoot = await dataSource
      .getRepository(Comment)
      .findOneByOrFail({ id: root.id });
    expect(storedRoot.reply_count).toBe(2);
    expect(await commentCount(video.id)).toBe(3);
  });

  it('should list replies oldest first across pages and refuse replies of a reply', async () => {
    const { video, ana, bia } = await setup();
    const root = await seedComment(dataSource, video, ana);
    const replies: Comment[] = [];
    for (let index = 0; index < 7; index++) {
      replies.push(
        await seedComment(dataSource, video, bia, {
          parent_id: root.id,
          text: `resposta ${index}`,
        }),
      );
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await service.listReplies(
        root.id,
        { cursor, limit: 3 },
        bia.id,
      );
      pages++;
      for (const item of page.items) {
        expect(item).toMatchObject({
          parent_id: root.id,
          viewer_is_author: true,
        });
        seen.push(item.id);
      }
      cursor = page.next_cursor ?? undefined;
    } while (cursor);

    expect(pages).toBe(3);
    expect(seen).toEqual(replies.map((reply) => reply.id));
    await expect(
      service.listReplies(replies[0].id, { limit: 20 }),
    ).rejects.toMatchObject({ errorCode: 'COMMENT_NOT_FOUND' });
  });
});
