import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Video } from '../videos/entities/video.entity';
import { VideoNotFoundException } from '../videos/videos.exceptions';
import { VideoReaction } from './entities/video-reaction.entity';
import { writeReaction } from './reaction-writer';
import { VideoReactionsService } from './video-reactions.service';

jest.mock('./reaction-writer');

const writeReactionMock = jest.mocked(writeReaction);

describe('VideoReactionsService', () => {
  let service: VideoReactionsService;
  const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>();
  const manager = { query };
  const transaction = jest.fn((cb: (m: typeof manager) => unknown) =>
    cb(manager),
  );
  const findVideo = jest.fn();
  const findReaction = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.startsWith('SELECT') ? [{ like_count: 3, dislike_count: 1 }] : [],
      ),
    );
    findVideo.mockResolvedValue({ id: 'video-1', public_id: 'pub' });

    const module = await Test.createTestingModule({
      providers: [
        VideoReactionsService,
        { provide: DataSource, useValue: { transaction } },
        {
          provide: getRepositoryToken(Video),
          useValue: { findOneBy: findVideo },
        },
        {
          provide: getRepositoryToken(VideoReaction),
          useValue: { findOneBy: findReaction },
        },
      ],
    }).compile();

    service = module.get(VideoReactionsService);
  });

  const counterUpdates = () =>
    query.mock.calls.filter(([sql]) => String(sql).startsWith('UPDATE'));

  it('should only accept published videos', async () => {
    findVideo.mockResolvedValue(null);

    await expect(service.set('pub', 'user-1', 'like')).rejects.toBeInstanceOf(
      VideoNotFoundException,
    );
    expect(findVideo).toHaveBeenCalledWith({
      public_id: 'pub',
      status: 'published',
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('should not touch the counters when the same value is set again', async () => {
    writeReactionMock.mockResolvedValue('like');

    const state = await service.set('pub', 'user-1', 'like');

    expect(counterUpdates()).toHaveLength(0);
    expect(state).toEqual({
      viewer_reaction: 'like',
      like_count: 3,
      dislike_count: 1,
    });
  });

  it('should not touch the counters when removing a missing reaction', async () => {
    writeReactionMock.mockResolvedValue(null);

    const state = await service.remove('pub', 'user-1');

    expect(writeReactionMock).toHaveBeenCalledWith(
      manager,
      VideoReaction,
      { user_id: 'user-1', video_id: 'video-1' },
      null,
    );
    expect(counterUpdates()).toHaveLength(0);
    expect(state.viewer_reaction).toBeNull();
  });

  it('should apply the transition delta when switching like → dislike', async () => {
    writeReactionMock.mockResolvedValue('like');

    await service.set('pub', 'user-1', 'dislike');

    expect(counterUpdates()).toHaveLength(1);
    expect(counterUpdates()[0][1]).toEqual([-1, 1, 'video-1']);
  });

  it('should return null as viewer reaction for anonymous viewers without querying', async () => {
    await expect(
      service.findViewerReaction('video-1', undefined),
    ).resolves.toBeNull();
    expect(findReaction).not.toHaveBeenCalled();
  });
});
