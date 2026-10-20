import { DataSource } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import type { QueueService } from '../queue/queue.service';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import { User } from '../users/entities/user.entity';
import { Video } from '../videos/entities/video.entity';
import { generatePublicId, storageKeys } from '../videos/public-id.util';
import { VideoViewsCleanupWorker } from './video-views-cleanup.worker';

describe('VideoViewsCleanupWorker (integration — DB real)', () => {
  let dataSource: DataSource;
  let worker: VideoViewsCleanupWorker;
  let videoId: string;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    // `handle()` only touches the database; the queue is used by onModuleInit, not exercised here.
    worker = new VideoViewsCleanupWorker({} as QueueService, dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    const users = dataSource.getRepository(User);
    const channels = dataSource.getRepository(Channel);
    const videos = dataSource.getRepository(Video);
    const user = await users.save(
      users.create({ email: 'cleanup@example.com', password: 'hashed' }),
    );
    const channel = await channels.save(
      channels.create({
        name: 'Cleanup',
        nickname: 'cleanup_chan',
        user_id: user.id,
      }),
    );
    const publicId = generatePublicId();
    const video = await videos.save(
      videos.create({
        public_id: publicId,
        channel_id: channel.id,
        original_filename: 'a.mp4',
        content_type: 'video/mp4',
        size_bytes: 1024,
        storage_key: storageKeys(publicId).source,
      }),
    );
    videoId = video.id;
  });

  /** One row per age, with `window_start` computed in SQL from the database's own UTC clock. */
  async function seedViewsDaysAgo(ages: number[]): Promise<void> {
    for (const age of ages) {
      await dataSource.query(
        `INSERT INTO "video_views" ("video_id", "viewer_key", "window_start")
         VALUES ($1, $2, (now() AT TIME ZONE 'UTC')::date - $3::int)`,
        [videoId, `anon:${age}`, age],
      );
    }
  }

  async function remainingKeys(): Promise<string[]> {
    const rows = await dataSource.query<{ viewer_key: string }[]>(
      `SELECT "viewer_key" FROM "video_views" ORDER BY "viewer_key"`,
    );
    return rows.map((row) => row.viewer_key);
  }

  it('should delete the buckets older than 2 days and keep today, yesterday and the day before', async () => {
    await seedViewsDaysAgo([5, 3, 2, 1, 0]);

    const deleted = await worker.handle();

    expect(deleted).toBe(2);
    expect(await remainingKeys()).toEqual(['anon:0', 'anon:1', 'anon:2']);
  });

  it('should be idempotent when it runs twice in a row', async () => {
    await seedViewsDaysAgo([5, 2, 1, 0]);

    await worker.handle();
    const secondRun = await worker.handle();

    expect(secondRun).toBe(0);
    expect(await remainingKeys()).toEqual(['anon:0', 'anon:1', 'anon:2']);
  });
});
