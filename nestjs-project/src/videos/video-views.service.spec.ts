import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import authConfig from '../config/auth.config';
import type { Video } from './entities/video.entity';
import { utcDay, VideoViewsService, type Viewer } from './video-views.service';

const DAY_1 = new Date('2026-10-19T23:59:00.000Z');
const DAY_2 = new Date('2026-10-20T00:01:00.000Z');

function publishedVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: 'video-1',
    channel_id: 'channel-owner',
    status: 'published',
    ...overrides,
  } as Video;
}

const ANON: Viewer = { ip: '203.0.113.10', userAgent: 'e2e-agent' };

describe('VideoViewsService', () => {
  let service: VideoViewsService;
  let channels: { findByUserId: jest.Mock };
  let execute: jest.Mock;
  let manager: { createQueryBuilder: jest.Mock; query: jest.Mock };
  let transaction: jest.Mock;

  beforeEach(async () => {
    execute = jest.fn().mockResolvedValue({ raw: [{ id: 'view-1' }] });
    // Fluent QueryBuilder: every step returns the builder; `execute` resolves the INSERT result.
    const builder: Record<string, jest.Mock> = { execute };
    for (const step of ['insert', 'into', 'values', 'orIgnore', 'returning']) {
      builder[step] = jest.fn(() => builder);
    }
    manager = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
      query: jest.fn().mockResolvedValue(undefined),
    };
    transaction = jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
      cb(manager),
    );
    channels = {
      findByUserId: jest.fn().mockResolvedValue({ id: 'channel-other' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        VideoViewsService,
        { provide: DataSource, useValue: { transaction } },
        { provide: ChannelsService, useValue: channels },
        { provide: authConfig.KEY, useValue: { jwtSecret: 'test-secret' } },
      ],
    }).compile();
    service = module.get(VideoViewsService);
  });

  it('should not record anything for a draft', async () => {
    const counted = await service.record(publishedVideo({ status: 'draft' }), {
      ...ANON,
      userId: 'user-1',
    });

    expect(counted).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('should not record the channel owner watching the published video', async () => {
    channels.findByUserId.mockResolvedValue({ id: 'channel-owner' });

    const counted = await service.record(publishedVideo(), {
      ...ANON,
      userId: 'owner',
    });

    expect(counted).toBe(false);
    expect(channels.findByUserId).toHaveBeenCalledWith('owner');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('should insert the view and increment view_count when the row is new', async () => {
    const counted = await service.record(publishedVideo(), ANON, DAY_1);

    expect(counted).toBe(true);
    expect(manager.query).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('"view_count" = "view_count" + 1'),
      ['video-1'],
    );
  });

  it('should not increment when the insert hit the unique key (same viewer, same day)', async () => {
    execute.mockResolvedValue({ raw: [] });

    const counted = await service.record(publishedVideo(), ANON, DAY_1);

    expect(counted).toBe(false);
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('should key authenticated viewers by user id', () => {
    expect(
      service.viewerKey({ ...ANON, userId: 'user-1' }, utcDay(DAY_1)),
    ).toBe('user:user-1');
  });

  it('should key anonymous viewers by an HMAC that hides the IP and changes every UTC day', () => {
    const day1 = service.viewerKey(ANON, utcDay(DAY_1));
    const day1Again = service.viewerKey(ANON, utcDay(DAY_1));
    const day2 = service.viewerKey(ANON, utcDay(DAY_2));
    const otherAgent = service.viewerKey(
      { ...ANON, userAgent: 'other-agent' },
      utcDay(DAY_1),
    );

    expect(day1).toMatch(/^anon:[0-9a-f]{64}$/);
    expect(day1).not.toContain(ANON.ip);
    expect(day1Again).toBe(day1);
    expect(day2).not.toBe(day1);
    expect(otherAgent).not.toBe(day1);
  });

  it('should bucket by the UTC calendar day', () => {
    expect(utcDay(DAY_1)).toBe('2026-10-19');
    expect(utcDay(DAY_2)).toBe('2026-10-20');
  });
});
