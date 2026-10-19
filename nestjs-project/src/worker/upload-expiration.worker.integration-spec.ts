import type { S3Client } from '@aws-sdk/client-s3';
import { Test, type TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { S3_INTERNAL_CLIENT } from '../storage/storage.constants';
import { StorageService } from '../storage/storage.service';
import { cleanAllTables } from '../test/create-test-data-source';
import {
  abortAllMultipart,
  cleanPrefix,
  deterministicBuffer,
  listMultipartUploads,
  putPart,
} from '../test/storage';
import { User } from '../users/entities/user.entity';
import { VideoUpload } from '../videos/entities/video-upload.entity';
import { Video } from '../videos/entities/video.entity';
import { VideosModule } from '../videos/videos.module';
import { VideosService } from '../videos/videos.service';
import { UploadExpirationWorker } from './upload-expiration.worker';
import { WorkerModule } from './worker.module';

const MIB = 1024 * 1024;
const QUEUE_SCHEMA = process.env.QUEUE_SCHEMA ?? 'pgboss';

async function waitFor<T>(
  probe: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs: number,
  intervalMs = 500,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = await probe();
  while (!predicate(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    last = await probe();
  }
  return last;
}

describe('UploadExpirationWorker (integration — DB, RustFS e pg-boss reais)', () => {
  let module: TestingModule;
  let worker: UploadExpirationWorker;
  let videos: VideosService;
  let storage: StorageService;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let uploadRepository: Repository<VideoUpload>;
  let s3: S3Client;
  let bucket: string;
  let user: User;

  beforeAll(async () => {
    process.env.UPLOAD_PART_SIZE = String(5 * MIB);
    process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT;
    // WorkerModule (consumidor, com a própria Config/TypeORM) + VideosModule (produtor: pré-cadastro).
    module = await Test.createTestingModule({
      imports: [WorkerModule, VideosModule],
    }).compile();
    await module.init();
    worker = module.get(UploadExpirationWorker);
    videos = module.get(VideosService);
    storage = module.get(StorageService);
    dataSource = module.get(DataSource);
    videoRepository = dataSource.getRepository(Video);
    uploadRepository = dataSource.getRepository(VideoUpload);
    s3 = module.get<S3Client>(S3_INTERNAL_CLIENT);
    bucket = process.env.S3_BUCKET!;
  }, 60000);

  afterAll(async () => {
    await abortAllMultipart(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'videos/');
    await module.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    await abortAllMultipart(s3, bucket, 'videos/');
    user = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: 'expire-int@example.com',
        password: 'hashed',
        is_confirmed: true,
      }),
    );
    await dataSource
      .getRepository(Channel)
      .save(
        dataSource
          .getRepository(Channel)
          .create({ name: 'Expire', nickname: 'expire_int', user_id: user.id }),
      );
  });

  /** Pré-cadastro real (agenda `upload.expire` em `expires_at`); devolve vídeo + sessão. */
  async function preRegister(sizeBytes = 5 * MIB) {
    const created = await videos.createUpload(user.id, {
      original_filename: 'a.mp4',
      content_type: 'video/mp4',
      size_bytes: sizeBytes,
    });
    const video = await videoRepository.findOneOrFail({
      where: { public_id: created.public_id },
      relations: ['upload'],
    });
    return { video, session: video.upload! };
  }

  /** UPLOAD_TTL mínimo é 60 s (Joi): adianta o job agendado para "agora" em vez de esperar. */
  async function fastForwardExpireJob(videoId: string): Promise<void> {
    // UPDATE … RETURNING no driver postgres do TypeORM devolve [rows, affectedCount].
    const [rows] = await dataSource.query<[{ id: string }[], number]>(
      `UPDATE "${QUEUE_SCHEMA}"."job" SET start_after = now()
       WHERE name = 'upload.expire' AND state = 'created' AND data->>'videoId' = $1 RETURNING id`,
      [videoId],
    );
    expect(rows).toHaveLength(1);
  }

  const job = (videoId: string) => ({
    id: `job-${videoId}`,
    name: QUEUE_NAMES.UPLOAD_EXPIRE,
    data: { videoId },
    retryCount: 0,
  });

  it('should expire a pre-registered upload that never completed: multipart aborted, draft and session gone', async () => {
    const { video, session } = await preRegister();

    await worker.handle(job(video.id));

    await expect(
      storage.listParts(video.storage_key, session.upload_id),
    ).resolves.toBeNull();
    await expect(
      listMultipartUploads(s3, bucket, `videos/${video.public_id}/`),
    ).resolves.toEqual([]);
    await expect(
      videoRepository.findOneBy({ id: video.id }),
    ).resolves.toBeNull();
    await expect(
      uploadRepository.findOneBy({ video_id: video.id }),
    ).resolves.toBeNull();
  }, 60000);

  it('should leave a completed upload intact: session completed, object present, video untouched', async () => {
    const { video, session } = await preRegister(5 * MIB);
    const presigned = await videos.presignParts(video, [1]);
    const etag = await putPart(
      presigned.parts[0].url,
      deterministicBuffer(5 * MIB, 1),
    );
    await videos.completeUpload(video, [{ part_number: 1, etag }]);
    const before = await videoRepository.findOneByOrFail({ id: video.id });

    await worker.handle(job(video.id));

    const after = await videoRepository.findOneByOrFail({ id: video.id });
    expect(after).toEqual(before);
    expect(after.processing_status).toBe('processing');
    await expect(
      uploadRepository.findOneByOrFail({ id: session.id }),
    ).resolves.toMatchObject({ state: 'completed' });
    await expect(storage.headObject(video.storage_key)).resolves.toMatchObject({
      contentLength: 5 * MIB,
    });
  }, 60000);

  it('should be idempotent: running the same job twice ends in the same state without error', async () => {
    const { video } = await preRegister();

    await worker.handle(job(video.id));
    await expect(worker.handle(job(video.id))).resolves.toBeUndefined();

    await expect(
      videoRepository.findOneBy({ id: video.id }),
    ).resolves.toBeNull();
  }, 60000);

  it('should succeed as a no-op for an unknown videoId', async () => {
    await expect(
      worker.handle(job('00000000-0000-0000-0000-000000000000')),
    ).resolves.toBeUndefined();
  });

  it('should consume the job scheduled by the pre-registration through the real queue once its start_after arrives', async () => {
    const { video, session } = await preRegister();
    await fastForwardExpireJob(video.id);

    const gone = await waitFor(
      () => videoRepository.findOneBy({ id: video.id }),
      (v) => v === null,
      30000,
    );

    expect(gone).toBeNull();
    await expect(
      storage.listParts(video.storage_key, session.upload_id),
    ).resolves.toBeNull();
    const jobs = await dataSource.query<{ state: string }[]>(
      `SELECT state FROM "${QUEUE_SCHEMA}"."job" WHERE name = 'upload.expire' AND data->>'videoId' = $1`,
      [video.id],
    );
    expect(jobs.map((j) => j.state)).toEqual(['completed']);
  }, 60000);
});
