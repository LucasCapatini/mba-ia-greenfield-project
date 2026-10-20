import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CommentNotFoundException } from '../comments/comments.exceptions';
import { Comment } from '../comments/entities/comment.entity';
import { CommentReactionsService } from './comment-reactions.service';
import { CommentReaction } from './entities/comment-reaction.entity';
import { writeReaction } from './reaction-writer';

jest.mock('./reaction-writer');

const writeReactionMock = jest.mocked(writeReaction);
const COMMENT_ID = '22222222-2222-4222-8222-222222222222';

describe('CommentReactionsService', () => {
  let service: CommentReactionsService;
  const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>();
  const manager = { query };
  const transaction = jest.fn((cb: (m: typeof manager) => unknown) =>
    cb(manager),
  );
  const findComment = jest.fn();
  const findReactions = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.startsWith('SELECT') ? [{ like_count: 4, dislike_count: 2 }] : [],
      ),
    );
    findComment.mockResolvedValue({
      id: COMMENT_ID,
      video: { status: 'published' },
    });

    const module = await Test.createTestingModule({
      providers: [
        CommentReactionsService,
        { provide: DataSource, useValue: { transaction } },
        {
          provide: getRepositoryToken(Comment),
          useValue: { findOne: findComment },
        },
        {
          provide: getRepositoryToken(CommentReaction),
          useValue: { find: findReactions },
        },
      ],
    }).compile();

    service = module.get(CommentReactionsService);
  });

  const counterUpdates = () =>
    query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE'));

  it('should not touch the counters when the same value is set again', async () => {
    writeReactionMock.mockResolvedValue('like');

    const state = await service.set(COMMENT_ID, 'user-1', 'like');

    expect(counterUpdates()).toHaveLength(0);
    expect(state).toEqual({
      viewer_reaction: 'like',
      like_count: 4,
      dislike_count: 2,
    });
  });

  it('should not touch the counters when removing a missing reaction', async () => {
    writeReactionMock.mockResolvedValue(null);

    const state = await service.remove(COMMENT_ID, 'user-1');

    expect(writeReactionMock).toHaveBeenCalledWith(
      manager,
      CommentReaction,
      { user_id: 'user-1', comment_id: COMMENT_ID },
      null,
    );
    expect(counterUpdates()).toHaveLength(0);
    expect(state.viewer_reaction).toBeNull();
  });

  it('should apply the transition delta to the comment counters', async () => {
    writeReactionMock.mockResolvedValue('dislike');

    await service.set(COMMENT_ID, 'user-1', 'like');

    expect(counterUpdates()).toEqual([
      [expect.stringContaining('"comments"'), [1, -1, COMMENT_ID]],
    ]);
  });

  it.each([
    ['a malformed id', 'nao-e-uuid', null],
    ['an unknown comment', COMMENT_ID, null],
    ['a comment of a draft video', COMMENT_ID, { video: { status: 'draft' } }],
  ])('should answer COMMENT_NOT_FOUND for %s', async (_label, id, stored) => {
    findComment.mockResolvedValue(stored);

    await expect(service.set(id, 'user-1', 'like')).rejects.toBeInstanceOf(
      CommentNotFoundException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('should not query reactions for an anonymous viewer', async () => {
    await expect(
      service.findViewerReactions([COMMENT_ID], undefined),
    ).resolves.toEqual(new Map());
    expect(findReactions).not.toHaveBeenCalled();
  });
});
