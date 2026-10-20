import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import type { DataSource } from 'typeorm';
import databaseConfig from '../config/database.config';
import queueConfig from '../config/queue.config';
import {
  ALL_ENTITIES,
  cleanQueueTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import { QUEUE_NAMES, singletonKeys } from './queue.constants';
import { QueueModule } from './queue.module';
import { QueueService } from './queue.service';

const QUEUE_SCHEMA = process.env.QUEUE_SCHEMA ?? 'pgboss';

async function waitFor<T>(
  probe: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs: number,
  intervalMs = 250,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = await probe();
  while (!predicate(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    last = await probe();
  }
  return last;
}

describe('QueueService (integration — pg-boss on the real PostgreSQL)', () => {
  let module: TestingModule;
  let service: QueueService;
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES, { synchronize: false });
    await dataSource.initialize();

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [databaseConfig, queueConfig],
        }),
        QueueModule,
      ],
    }).compile();
    await module.init(); // dispara onModuleInit → boss.start() + createQueue
    service = module.get(QueueService);
  }, 30000);

  afterAll(async () => {
    await module.close(); // onModuleDestroy → boss.stop()
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanQueueTables(dataSource);
  });

  afterEach(async () => {
    // Cada teste registra o próprio handler; sem isto um worker de um teste anterior
    // (ex.: o que lança) capturaria os jobs do teste seguinte.
    await service.offWork(QUEUE_NAMES.VIDEO_PROCESS);
    await service.offWork(QUEUE_NAMES.UPLOAD_EXPIRE);
  });

  it('should create the pgboss schema and register both phase queues on start', async () => {
    const schemas = await dataSource.query<{ schema_name: string }[]>(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [QUEUE_SCHEMA],
    );

    expect(schemas).toHaveLength(1);
    await expect(service.hasQueue(QUEUE_NAMES.VIDEO_PROCESS)).resolves.toBe(
      true,
    );
    await expect(service.hasQueue(QUEUE_NAMES.UPLOAD_EXPIRE)).resolves.toBe(
      true,
    );
    const policies = await dataSource.query<{ name: string; policy: string }[]>(
      `SELECT name, policy FROM "${QUEUE_SCHEMA}"."queue" WHERE name = ANY($1::text[]) ORDER BY name`,
      [[QUEUE_NAMES.UPLOAD_EXPIRE, QUEUE_NAMES.VIDEO_PROCESS]],
    );
    expect(policies.map((row) => row.policy)).toEqual([
      'exclusive',
      'exclusive',
    ]);
  });

  it('should register a UTC cron schedule for the video views cleanup and overwrite it on reschedule', async () => {
    await service.schedule(QUEUE_NAMES.VIDEO_VIEWS_CLEANUP, '0 4 * * *', {});
    await service.schedule(QUEUE_NAMES.VIDEO_VIEWS_CLEANUP, '0 3 * * *', {});

    const rows = await dataSource.query<{ cron: string; timezone: string }[]>(
      `SELECT "cron", "timezone" FROM "${QUEUE_SCHEMA}"."schedule" WHERE "name" = $1`,
      [QUEUE_NAMES.VIDEO_VIEWS_CLEANUP],
    );
    expect(rows).toEqual([{ cron: '0 3 * * *', timezone: 'UTC' }]);
    await expect(
      service.hasQueue(QUEUE_NAMES.VIDEO_VIEWS_CLEANUP),
    ).resolves.toBe(true);
  });

  it('should keep a single active job per singleton key', async () => {
    const videoId = randomUUID();
    const key = singletonKeys.videoProcess(videoId);

    const first = await service.send(
      QUEUE_NAMES.VIDEO_PROCESS,
      { videoId },
      { singletonKey: key },
    );
    const second = await service.send(
      QUEUE_NAMES.VIDEO_PROCESS,
      { videoId },
      { singletonKey: key },
    );

    expect(first).toEqual(expect.any(String));
    expect(second).toBeNull();
    const rows = await dataSource.query<{ count: string }[]>(
      `SELECT count(*)::text AS count FROM "${QUEUE_SCHEMA}"."job"
       WHERE name = $1 AND singleton_key = $2 AND state IN ('created', 'retry', 'active')`,
      [QUEUE_NAMES.VIDEO_PROCESS, key],
    );
    expect(rows[0].count).toBe('1');
  });

  it('should hold a delayed job (startAfter) until its time and not deliver it early', async () => {
    const videoId = randomUUID();
    const received: string[] = [];
    await service.work(
      QUEUE_NAMES.UPLOAD_EXPIRE,
      { batchSize: 1, pollingIntervalSeconds: 0.5 },
      (jobs) => {
        received.push(...jobs.map((job) => job.data.videoId));
        return Promise.resolve();
      },
    );

    const startAfter = new Date(Date.now() + 60_000);
    const id = await service.send(
      QUEUE_NAMES.UPLOAD_EXPIRE,
      { videoId },
      { singletonKey: singletonKeys.uploadExpire(videoId), startAfter },
    );
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(received).not.toContain(videoId);
    const job = await service.getJob(QUEUE_NAMES.UPLOAD_EXPIRE, id!);
    expect(job?.state).toBe('created');
    expect(
      Math.abs(job!.startAfter.getTime() - startAfter.getTime()),
    ).toBeLessThan(1000);
  }, 15000);

  it('should retry a throwing handler up to retryLimit and then mark the job failed without crashing', async () => {
    const videoId = randomUUID();
    let attempts = 0;
    await service.work(
      QUEUE_NAMES.VIDEO_PROCESS,
      { batchSize: 1, pollingIntervalSeconds: 0.5 },
      () => {
        attempts++;
        return Promise.reject(new Error('ffprobe exploded'));
      },
    );

    const id = await service.send(
      QUEUE_NAMES.VIDEO_PROCESS,
      { videoId },
      {
        singletonKey: singletonKeys.videoProcess(videoId),
        retryLimit: 1,
        retryDelay: 0,
        retryBackoff: false,
      },
    );
    const job = await waitFor(
      () => service.getJob(QUEUE_NAMES.VIDEO_PROCESS, id!),
      (value) => value?.state === 'failed',
      15_000,
    );

    expect(job?.state).toBe('failed');
    expect(attempts).toBe(2);
    expect(job?.retryCount).toBe(1);
  }, 20000);

  it('should deliver a job to the registered handler and complete it on return', async () => {
    const videoId = randomUUID();
    const received: string[] = [];
    await service.work(
      QUEUE_NAMES.VIDEO_PROCESS,
      { batchSize: 1, pollingIntervalSeconds: 0.5 },
      (jobs) => {
        received.push(...jobs.map((job) => job.data.videoId));
        return Promise.resolve();
      },
    );

    const id = await service.send(
      QUEUE_NAMES.VIDEO_PROCESS,
      { videoId },
      { singletonKey: singletonKeys.videoProcess(videoId) },
    );
    const job = await waitFor(
      () => service.getJob(QUEUE_NAMES.VIDEO_PROCESS, id!),
      (value) => value?.state === 'completed',
      15_000,
    );

    expect(received).toContain(videoId);
    expect(job?.state).toBe('completed');
  }, 20000);
});
