// Generated from specs/videos-delete.plan.md (SI-04.9 — phase-04-video-channel-management).
// One describe per spec; one test per scenario; group headings kept as comments.
import type { S3Client } from '@aws-sdk/client-s3';
import {
  INestApplication,
  type INestApplicationContext,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { MailService } from '../src/mail/mail.service';
import { S3_INTERNAL_CLIENT } from '../src/storage/storage.constants';
import { StorageService } from '../src/storage/storage.service';
import { cleanAllTables } from '../src/test/create-test-data-source';
import {
  abortAllMultipart,
  cleanPrefix,
  deterministicBuffer,
} from '../src/test/storage';
import { Video } from '../src/videos/entities/video.entity';
import { WorkerModule } from '../src/worker/worker.module';

const PASSWORD = 'password123';
const MIB = 1024 * 1024;
const QUEUE_SCHEMA = process.env.QUEUE_SCHEMA ?? 'pgboss';
const UNKNOWN_ID = 'AAAAAAAAAAA';

type ErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
};

function errorBody(res: request.Response): ErrorBody {
  return res.body as ErrorBody;
}

describe('videos-delete', () => {
  let app: INestApplication<App>;
  let worker: INestApplicationContext;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let storageService: StorageService;
  let s3: S3Client;
  let bucket: string;
  let mailService: MailService;
  let throttlerStorage: ThrottlerStorageService;

  beforeAll(async () => {
    process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Reproduces main.ts — the testing module does not run it.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(
      new DomainExceptionFilter(),
      new ValidationExceptionFilter(),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    videoRepository = dataSource.getRepository(Video);
    storageService = moduleFixture.get(StorageService);
    s3 = moduleFixture.get<S3Client>(S3_INTERNAL_CLIENT);
    bucket = process.env.S3_BUCKET!;
    mailService = moduleFixture.get(MailService);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);

    // Worker real no mesmo processo (phase-03/TD-05): consome `video.delete` do schema de testes
    // da fila (`pgboss_test`, isolado do video-worker do compose pelo shim jest-env.cjs).
    worker = await NestFactory.createApplicationContext(WorkerModule, {
      logger: ['error', 'warn'],
    });
  }, 120000);

  afterAll(async () => {
    await worker?.close();
    await abortAllMultipart(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'thumbnails/');
    await cleanAllTables(dataSource);
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    throttlerStorage.storage.clear();
    await abortAllMultipart(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'thumbnails/');
  });

  /** Registra, confirma (token capturado via spy do MailService) e loga `email`; devolve o access token. */
  async function authenticate(email: string): Promise<string> {
    let token = '';
    jest
      .spyOn(mailService, 'sendConfirmationEmail')
      .mockImplementationOnce(
        (_to: string, _name: string, raw: string): Promise<void> => {
          token = raw;
          return Promise.resolve();
        },
      );
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    await request(app.getHttpServer())
      .get('/auth/confirm-email')
      .query({ token })
      .expect(204);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (login.body as { access_token: string }).access_token;
  }

  async function createDraft(
    token: string,
  ): Promise<{ publicId: string; uploadId: string }> {
    const res = await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        original_filename: 'apagar.mp4',
        content_type: 'video/mp4',
        size_bytes: MIB,
      })
      .expect(201);
    const body = res.body as {
      public_id: string;
      processing_status: string;
      upload: { upload_id: string };
    };
    expect(body.processing_status).toBe('uploading');
    return { publicId: body.public_id, uploadId: body.upload.upload_id };
  }

  /** Vídeo `ready` com os objetos no storage (sem worker de processamento). */
  async function seedReadyVideo(
    token: string,
    { withCustomThumbnail }: { withCustomThumbnail: boolean },
  ): Promise<string> {
    const { publicId } = await createDraft(token);
    const source = `videos/${publicId}/source`;
    const auto = `thumbnails/${publicId}/auto.jpg`;
    const custom = `thumbnails/${publicId}/custom.jpg`;
    await videoRepository.manager.query(
      `UPDATE "video_uploads" SET "state" = 'completed' WHERE "video_id" = (SELECT "id" FROM "videos" WHERE "public_id" = $1)`,
      [publicId],
    );
    await abortAllMultipart(s3, bucket, source);
    await storageService.putObject(
      source,
      deterministicBuffer(MIB),
      'video/mp4',
    );
    await storageService.putObject(
      auto,
      deterministicBuffer(256),
      'image/jpeg',
    );
    if (withCustomThumbnail) {
      await storageService.putObject(
        custom,
        deterministicBuffer(256),
        'image/jpeg',
      );
    }
    await videoRepository.update(
      { public_id: publicId },
      {
        processing_status: 'ready',
        thumbnail_key: auto,
        custom_thumbnail_key: withCustomThumbnail ? custom : null,
      },
    );
    return publicId;
  }

  async function waitUntilGone(key: string): Promise<void> {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if ((await storageService.headObject(key)) === null) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`${key} still exists after 20 s`);
  }

  async function deleteJobs(
    videoId: string,
  ): Promise<{ singleton_key: string; state: string }[]> {
    const tables = await dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_name IN ('job', 'archive')`,
      [QUEUE_SCHEMA],
    );
    const rows: { singleton_key: string; state: string }[] = [];
    for (const { table_name } of tables) {
      rows.push(
        ...(await dataSource.query<{ singleton_key: string; state: string }[]>(
          `SELECT singleton_key, state FROM "${QUEUE_SCHEMA}"."${table_name}"
           WHERE name = 'video.delete' AND data->>'videoId' = $1`,
          [videoId],
        )),
      );
    }
    return rows;
  }

  const api = {
    get: (path: string, token: string) =>
      request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${token}`),
    delete: (id: string, token?: string) => {
      const req = request(app.getHttpServer()).delete(`/videos/${id}`);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    },
  };

  // ### 1. Excluir vídeo pronto

  test('1.1 owner-deletes-ready-video-and-worker-frees-storage', async () => {
    const token = await authenticate('apagar@example.com');
    const publicId = await seedReadyVideo(token, { withCustomThumbnail: true });
    const { id: videoId } = await videoRepository.findOneByOrFail({
      public_id: publicId,
    });

    const res = await api.delete(publicId, token).expect(204);
    expect(res.text).toBe('');

    const gone = await api.get(`/videos/${publicId}`, token).expect(404);
    expect(errorBody(gone).error).toBe('VIDEO_NOT_FOUND');
    const [{ count }] = await dataSource.query<{ count: string }[]>(
      `SELECT count(*) FROM "video_uploads" WHERE "video_id" = $1`,
      [videoId],
    );
    expect(Number(count)).toBe(0);

    await waitUntilGone(`videos/${publicId}/source`);
    await waitUntilGone(`thumbnails/${publicId}/auto.jpg`);
    await waitUntilGone(`thumbnails/${publicId}/custom.jpg`);

    let jobs = await deleteJobs(videoId);
    const deadline = Date.now() + 10_000;
    while (jobs[0]?.state !== 'completed' && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      jobs = await deleteJobs(videoId);
    }
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toEqual({
      singleton_key: `video-delete:${videoId}`,
      state: 'completed',
    });
  }, 60000);

  // ### 2. Excluir durante o upload

  test('2.1 deleting-with-active-upload-aborts-multipart', async () => {
    const token = await authenticate('apagar-upload@example.com');
    const { publicId, uploadId } = await createDraft(token);

    await api.delete(publicId, token).expect(204);

    await expect(
      storageService.listParts(`videos/${publicId}/source`, uploadId),
    ).resolves.toBeNull();
    const upload = await api
      .get(`/videos/${publicId}/upload`, token)
      .expect(404);
    expect(errorBody(upload).error).toBe('VIDEO_NOT_FOUND');
  });

  // ### 3. Autorização

  test('3.1 non-owner-anonymous-and-unknown-cannot-delete', async () => {
    const ownerToken = await authenticate('dono-del@example.com');
    const intruderToken = await authenticate('intruso-del@example.com');
    const publicId = await seedReadyVideo(ownerToken, {
      withCustomThumbnail: false,
    });

    // Sequencial: requisições concorrentes contra o servidor do supertest resetam a conexão.
    const forbidden = await api.delete(publicId, intruderToken).expect(403);
    expect(errorBody(forbidden).error).toBe('VIDEO_FORBIDDEN');
    await api.get(`/videos/${publicId}`, ownerToken).expect(200);
    await expect(
      storageService.headObject(`videos/${publicId}/source`),
    ).resolves.not.toBeNull();

    await api.delete(publicId).expect(401);

    const unknown = await api.delete(UNKNOWN_ID, ownerToken).expect(404);
    expect(errorBody(unknown).error).toBe('VIDEO_NOT_FOUND');
  });
});
