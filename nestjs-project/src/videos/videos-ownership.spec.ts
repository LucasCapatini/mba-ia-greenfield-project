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

  it('should return the video with its upload session when the user owns the channel', async () => {
    await expect(ownership.loadOwned('user-1', 'abcdefghijk')).resolves.toBe(
      video,
    );

    expect(videoRepository.findOne).toHaveBeenCalledWith({
      where: { public_id: 'abcdefghijk' },
      relations: ['upload'],
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
});
