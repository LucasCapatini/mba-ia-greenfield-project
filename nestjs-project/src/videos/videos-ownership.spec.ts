import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChannelsService } from '../channels/channels.service';
import { Video } from './entities/video.entity';
import { VideosOwnership } from './videos-ownership';
import {
  VideoForbiddenException,
  VideoNotFoundException,
} from './videos.exceptions';

describe('VideosOwnership', () => {
  let ownership: VideosOwnership;
  let videoRepository: { findOne: jest.Mock };
  let channels: { findByUserId: jest.Mock };

  const video = {
    id: 'video-1',
    public_id: 'abcdefghijk',
    channel_id: 'channel-owner',
    upload: { id: 'session-1', state: 'active' },
  };

  beforeEach(async () => {
    videoRepository = { findOne: jest.fn().mockResolvedValue(video) };
    channels = {
      findByUserId: jest.fn().mockResolvedValue({ id: 'channel-owner' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        VideosOwnership,
        { provide: getRepositoryToken(Video), useValue: videoRepository },
        { provide: ChannelsService, useValue: channels },
      ],
    }).compile();
    ownership = module.get(VideosOwnership);
  });

  it('should return the video with its upload session and category when the user owns the channel', async () => {
    await expect(ownership.loadOwned('user-1', 'abcdefghijk')).resolves.toBe(
      video,
    );

    expect(videoRepository.findOne).toHaveBeenCalledWith({
      where: { public_id: 'abcdefghijk' },
      relations: ['upload', 'category'],
    });
    expect(channels.findByUserId).toHaveBeenCalledWith('user-1');
  });

  it('should throw 404 VIDEO_NOT_FOUND before resolving the channel when the public_id is unknown', async () => {
    videoRepository.findOne.mockResolvedValueOnce(null);

    const promise = ownership.loadOwned('user-1', 'AAAAAAAAAAA');

    await expect(promise).rejects.toBeInstanceOf(VideoNotFoundException);
    await expect(promise).rejects.toMatchObject({
      httpStatus: 404,
      errorCode: 'VIDEO_NOT_FOUND',
    });
    expect(channels.findByUserId).not.toHaveBeenCalled();
  });

  it('should throw 403 VIDEO_FORBIDDEN when the video belongs to another channel', async () => {
    channels.findByUserId.mockResolvedValueOnce({ id: 'channel-intruder' });

    const promise = ownership.loadOwned('intruder', 'abcdefghijk');

    await expect(promise).rejects.toBeInstanceOf(VideoForbiddenException);
    await expect(promise).rejects.toMatchObject({
      httpStatus: 403,
      errorCode: 'VIDEO_FORBIDDEN',
    });
  });

  it('should throw 403 VIDEO_FORBIDDEN when the user has no channel at all', async () => {
    channels.findByUserId.mockResolvedValueOnce(null);

    await expect(
      ownership.loadOwned('ghost', 'abcdefghijk'),
    ).rejects.toBeInstanceOf(VideoForbiddenException);
  });

  describe('loadReadable (public read rule — TD-07)', () => {
    const owner = { sub: 'user-1', email: 'owner@example.com' };
    const stranger = { sub: 'user-2', email: 'stranger@example.com' };

    function withVideo(overrides: Record<string, unknown>) {
      const readable = { ...video, ...overrides };
      videoRepository.findOne.mockResolvedValueOnce(readable);
      return readable;
    }

    it('should let the owner read a draft', async () => {
      const draft = withVideo({ status: 'draft' });

      await expect(ownership.loadReadable(owner, 'abcdefghijk')).resolves.toBe(
        draft,
      );
      expect(channels.findByUserId).toHaveBeenCalledWith('user-1');
    });

    it('should let an anonymous request read a published video without looking up channels', async () => {
      const published = withVideo({
        status: 'published',
        visibility: 'public',
      });

      await expect(
        ownership.loadReadable(undefined, 'abcdefghijk'),
      ).resolves.toBe(published);
      expect(channels.findByUserId).not.toHaveBeenCalled();
    });

    it('should let an authenticated non-owner read a published unlisted video', async () => {
      const unlisted = withVideo({
        status: 'published',
        visibility: 'unlisted',
      });
      channels.findByUserId.mockResolvedValueOnce({ id: 'channel-other' });

      await expect(
        ownership.loadReadable(stranger, 'abcdefghijk'),
      ).resolves.toBe(unlisted);
    });

    it('should answer 404 VIDEO_NOT_FOUND to an anonymous request for a draft', async () => {
      withVideo({ status: 'draft' });

      const promise = ownership.loadReadable(undefined, 'abcdefghijk');

      await expect(promise).rejects.toBeInstanceOf(VideoNotFoundException);
      await expect(promise).rejects.toMatchObject({
        httpStatus: 404,
        errorCode: 'VIDEO_NOT_FOUND',
      });
      expect(channels.findByUserId).not.toHaveBeenCalled();
    });

    it('should answer 404 (never 403) to an authenticated non-owner for a draft', async () => {
      withVideo({ status: 'draft' });
      channels.findByUserId.mockResolvedValueOnce({ id: 'channel-other' });

      await expect(
        ownership.loadReadable(stranger, 'abcdefghijk'),
      ).rejects.toBeInstanceOf(VideoNotFoundException);
    });

    it('should answer 404 when the public_id does not exist', async () => {
      videoRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        ownership.loadReadable(owner, 'AAAAAAAAAAA'),
      ).rejects.toBeInstanceOf(VideoNotFoundException);
    });
  });
});
