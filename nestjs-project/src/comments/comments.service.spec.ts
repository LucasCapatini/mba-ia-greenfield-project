import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import { CommentReactionsService } from '../reactions/comment-reactions.service';
import { Video } from '../videos/entities/video.entity';
import { VideoNotFoundException } from '../videos/videos.exceptions';
import {
  CommentForbiddenException,
  CommentNotFoundException,
} from './comments.exceptions';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';

const COMMENT_ID = '11111111-1111-4111-8111-111111111111';

describe('CommentsService', () => {
  let service: CommentsService;
  const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>();
  const execute = jest.fn<Promise<{ raw: unknown[] }>, []>();
  // Cadeia do DeleteQueryBuilder: cada passo devolve o próprio builder, `execute` encerra.
  const builder: Record<string, jest.Mock> = {};
  for (const step of ['delete', 'from', 'where', 'returning']) {
    builder[step] = jest.fn(() => builder);
  }
  builder.execute = execute;
  const saveComment = jest.fn((comment: Partial<Comment>) =>
    Promise.resolve({
      id: 'new-reply',
      like_count: 0,
      dislike_count: 0,
      reply_count: 0,
      edited_at: null,
      created_at: new Date('2026-10-20T05:00:00.000Z'),
      ...comment,
    }),
  );
  const manager = {
    query,
    createQueryBuilder: jest.fn(() => builder),
    getRepository: jest.fn(() => ({
      create: (comment: Partial<Comment>) => comment,
      save: saveComment,
    })),
  };
  const transaction = jest.fn((cb: (m: typeof manager) => unknown) =>
    cb(manager),
  );
  const findComment = jest.fn();
  const updateComment = jest.fn();
  const findVideo = jest.fn();

  function storedComment(overrides: Partial<Comment> = {}) {
    return {
      id: COMMENT_ID,
      video_id: 'video-1',
      user_id: 'author-1',
      parent_id: null,
      reply_count: 2,
      video: { status: 'published' },
      ...overrides,
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    query.mockResolvedValue([]);
    findComment.mockResolvedValue(storedComment());

    const module = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: DataSource, useValue: { transaction } },
        {
          provide: getRepositoryToken(Comment),
          useValue: { findOne: findComment, update: updateComment },
        },
        {
          provide: getRepositoryToken(Video),
          useValue: { findOneBy: findVideo },
        },
        {
          provide: getRepositoryToken(Channel),
          useValue: {
            find: jest
              .fn()
              .mockResolvedValue([
                { user_id: 'replier', nickname: 'bia', name: 'Bia' },
              ]),
          },
        },
        {
          provide: CommentReactionsService,
          useValue: {
            findViewerReactions: jest.fn().mockResolvedValue(new Map()),
          },
        },
      ],
    }).compile();

    service = module.get(CommentsService);
  });

  const videoCounterDeltas = () =>
    query.mock.calls
      .filter(([sql]) => sql.includes('"comment_count"'))
      .map(([, params]) => params?.[0]);

  it('should forbid editing or deleting by someone other than the author', async () => {
    await expect(
      service.update(COMMENT_ID, 'intruder', 'novo'),
    ).rejects.toBeInstanceOf(CommentForbiddenException);
    await expect(service.remove(COMMENT_ID, 'intruder')).rejects.toBeInstanceOf(
      CommentForbiddenException,
    );
    expect(updateComment).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('should hide comments of a video that is not published', async () => {
    findComment.mockResolvedValue(
      storedComment({ video: { status: 'draft' } as Video }),
    );

    await expect(
      service.update(COMMENT_ID, 'author-1', 'novo'),
    ).rejects.toBeInstanceOf(CommentNotFoundException);
    await expect(service.remove(COMMENT_ID, 'author-1')).rejects.toBeInstanceOf(
      CommentNotFoundException,
    );
  });

  it('should answer COMMENT_NOT_FOUND for a malformed id without querying', async () => {
    await expect(
      service.remove('nao-e-uuid', 'author-1'),
    ).rejects.toBeInstanceOf(CommentNotFoundException);
    expect(findComment).not.toHaveBeenCalled();
  });

  it('should only accept comments on published videos', async () => {
    findVideo.mockResolvedValue(null);

    await expect(
      service.create('pub', 'author-1', 'oi'),
    ).rejects.toBeInstanceOf(VideoNotFoundException);
    expect(findVideo).toHaveBeenCalledWith({
      public_id: 'pub',
      status: 'published',
    });
  });

  it('should take 1 + reply_count from the video when a root is deleted', async () => {
    execute.mockResolvedValue({ raw: [{ reply_count: 2, parent_id: null }] });

    await service.remove(COMMENT_ID, 'author-1');

    expect(videoCounterDeltas()).toEqual([-3]);
  });

  it('should take 1 from the video and from the root when a reply is deleted', async () => {
    findComment.mockResolvedValue(
      storedComment({ parent_id: 'root-1', reply_count: 0 }),
    );
    execute.mockResolvedValue({
      raw: [{ reply_count: 0, parent_id: 'root-1' }],
    });

    await service.remove(COMMENT_ID, 'author-1');

    expect(videoCounterDeltas()).toEqual([-1]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('"reply_count" = "reply_count" - 1'),
      ['root-1'],
    );
  });

  it('should not move counters when a concurrent delete already removed the row', async () => {
    execute.mockResolvedValue({ raw: [] });

    await service.remove(COMMENT_ID, 'author-1');

    expect(query).not.toHaveBeenCalled();
  });

  it('should attach a reply to a reply under the root it belongs to', async () => {
    findComment.mockResolvedValue(
      storedComment({ parent_id: 'root-1', reply_count: 0 }),
    );

    const reply = await service.reply(COMMENT_ID, 'replier', '@ana valeu');

    expect(saveComment).toHaveBeenCalledWith(
      expect.objectContaining({ parent_id: 'root-1', video_id: 'video-1' }),
    );
    expect(reply.parent_id).toBe('root-1');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('"reply_count" = "reply_count" + 1'),
      ['root-1'],
    );
    expect(videoCounterDeltas()).toEqual([1]);
  });

  it('should refuse to reply on a comment of a video that is not published', async () => {
    findComment.mockResolvedValue(
      storedComment({ video: { status: 'draft' } as Video }),
    );

    await expect(
      service.reply(COMMENT_ID, 'replier', 'oi'),
    ).rejects.toBeInstanceOf(CommentNotFoundException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
