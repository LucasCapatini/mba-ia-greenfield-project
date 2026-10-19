// Generated from specs/videos-upload.plan.md (SI-03.6 — phase-03-upload-processing).
// One describe per spec; one test per scenario; group headings kept as comments.
import type { S3Client } from '@aws-sdk/client-s3';
import { INestApplication, ValidationPipe } from '@nestjs/common';
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
  listMultipartUploads,
  putPart,
} from '../src/test/storage';
import { VideoUpload } from '../src/videos/entities/video-upload.entity';
import { Video } from '../src/videos/entities/video.entity';

const PASSWORD = 'password123';
const MIB = 1024 * 1024;
const PART_SIZE = 5 * MIB;
const TWELVE_MIB = 12 * MIB;
const UNKNOWN_ID = 'AAAAAAAAAAA';
const QUEUE_SCHEMA = process.env.QUEUE_SCHEMA ?? 'pgboss';

type ErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
};
type PresignedPart = { part_number: number; url: string };
type JobRow = { singleton_key: string; retry_limit: number; state: string };

function errorBody(res: request.Response): ErrorBody {
  return res.body as ErrorBody;
}

/** Fatias de 5 MiB (a última menor) com bytes determinísticos — "10 GB sem 10 GB" (TD-13). */
function buffers(sizeBytes: number): Buffer[] {
  const out: Buffer[] = [];
  for (let offset = 0, n = 1; offset < sizeBytes; offset += PART_SIZE, n++) {
    out.push(deterministicBuffer(Math.min(PART_SIZE, sizeBytes - offset), n));
  }
  return out;
}

describe('videos-upload', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let uploadRepository: Repository<VideoUpload>;
  let storageService: StorageService;
  let s3: S3Client;
  let bucket: string;
  let mailService: MailService;
  let throttlerStorage: ThrottlerStorageService;
  let publicEndpoint: string;

  beforeAll(async () => {
    // Dentro do container a assinatura SigV4 precisa apontar para o host alcançável (rustfs:9000).
    process.env.UPLOAD_PART_SIZE = String(PART_SIZE);
    process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT;
    publicEndpoint = process.env.S3_PUBLIC_ENDPOINT!;

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
    uploadRepository = dataSource.getRepository(VideoUpload);
    storageService = moduleFixture.get(StorageService);
    s3 = moduleFixture.get<S3Client>(S3_INTERNAL_CLIENT);
    bucket = process.env.S3_BUCKET!;
    mailService = moduleFixture.get(MailService);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
  }, 60000);

  afterAll(async () => {
    await abortAllMultipart(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'videos/');
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    throttlerStorage.storage.clear();
    await abortAllMultipart(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'videos/');
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

  function withAuth(req: request.Test, token?: string): request.Test {
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  const api = {
    parts: (id: string, token?: string) =>
      withAuth(
        request(app.getHttpServer()).post(`/videos/${id}/upload/parts`),
        token,
      ),
    state: (id: string, token?: string) =>
      withAuth(request(app.getHttpServer()).get(`/videos/${id}/upload`), token),
    complete: (id: string, token?: string) =>
      withAuth(
        request(app.getHttpServer()).post(`/videos/${id}/upload/complete`),
        token,
      ),
    abort: (id: string, token?: string) =>
      withAuth(
        request(app.getHttpServer()).delete(`/videos/${id}/upload`),
        token,
      ),
  };

  /** `POST /videos` com `video/mp4`; devolve `public_id` e `upload_id`. */
  async function createUpload(token: string, sizeBytes: number) {
    const res = await withAuth(
      request(app.getHttpServer()).post('/videos'),
      token,
    )
      .send({
        original_filename: 'a.mp4',
        content_type: 'video/mp4',
        size_bytes: sizeBytes,
      })
      .expect(201);
    return {
      publicId: res.body.public_id as string,
      uploadId: res.body.upload.upload_id as string,
    };
  }

  /** Pede URLs para `partNumbers` e devolve-as indexadas por número. */
  async function presign(
    token: string,
    publicId: string,
    partNumbers: number[],
  ) {
    const res = await api
      .parts(publicId, token)
      .send({ part_numbers: partNumbers })
      .expect(200);
    return new Map(
      (res.body.parts as PresignedPart[]).map((p) => [p.part_number, p.url]),
    );
  }

  /** Envia as partes indicadas via fetch nativo; devolve os ETags por número. */
  async function sendParts(
    urls: Map<number, string>,
    chunks: Buffer[],
    partNumbers: number[],
  ) {
    const etags = new Map<number, string>();
    for (const n of partNumbers) {
      etags.set(n, await putPart(urls.get(n)!, chunks[n - 1]));
    }
    return etags;
  }

  async function videoProcessJobs(videoId: string): Promise<JobRow[]> {
    return dataSource.query<JobRow[]>(
      `SELECT singleton_key, retry_limit, state FROM "${QUEUE_SCHEMA}"."job"
       WHERE name = 'video.process' AND data->>'videoId' = $1`,
      [videoId],
    );
  }

  // ### 1. POST /videos/{publicId}/upload/parts

  test('1.1 owner-gets-presigned-urls-for-batch', async () => {
    const token = await authenticate('owner-parts@example.com');
    const { publicId, uploadId } = await createUpload(token, TWELVE_MIB);

    const res = await api
      .parts(publicId, token)
      .send({ part_numbers: [1, 2, 3] })
      .expect(200);

    expect(res.body.upload_id).toBe(uploadId);
    expect(res.body.part_size).toBe(PART_SIZE);
    expect(new Date(res.body.expires_at).getTime()).toBeGreaterThan(Date.now());
    const parts = res.body.parts as PresignedPart[];
    expect(parts.map((p) => p.part_number)).toEqual([1, 2, 3]);
    expect(new Set(parts.map((p) => p.url)).size).toBe(3);
    for (const part of parts) {
      expect(part.url.startsWith(publicEndpoint)).toBe(true);
      expect(part.url).toContain(`partNumber=${part.part_number}`);
      expect(part.url).toContain('uploadId=');
    }

    const outOfRange = await api
      .parts(publicId, token)
      .send({ part_numbers: [4] })
      .expect(400);
    expect(errorBody(outOfRange).error).toBe('VALIDATION_ERROR');

    const duplicated = await api
      .parts(publicId, token)
      .send({ part_numbers: [1, 1] })
      .expect(400);
    expect(errorBody(duplicated).error).toBe('VALIDATION_ERROR');
  });

  // ### 2. GET /videos/{publicId}/upload

  test('2.1 state-lists-parts-accepted-by-storage', async () => {
    const token = await authenticate('owner-state@example.com');
    const { publicId } = await createUpload(token, TWELVE_MIB);
    const urls = await presign(token, publicId, [1, 2, 3]);
    const etags = await sendParts(urls, buffers(TWELVE_MIB), [1, 2]);
    expect(etags.get(1)).not.toBe('');
    expect(etags.get(2)).not.toBe('');

    const res = await api.state(publicId, token).expect(200);

    expect(res.body).toMatchObject({
      state: 'active',
      part_size: PART_SIZE,
      part_count: 3,
      expected_bytes: TWELVE_MIB,
    });
    expect(res.body.uploaded_parts).toEqual([
      { part_number: 1, etag: etags.get(1), size: PART_SIZE },
      { part_number: 2, etag: etags.get(2), size: PART_SIZE },
    ]);
  });

  // ### 3. POST /videos/{publicId}/upload/complete

  test('3.1 complete-with-all-parts-starts-processing', async () => {
    const token = await authenticate('owner-complete@example.com');
    const { publicId } = await createUpload(token, TWELVE_MIB);
    const urls = await presign(token, publicId, [1, 2, 3]);
    const etags = await sendParts(urls, buffers(TWELVE_MIB), [1, 2, 3]);

    const res = await api
      .complete(publicId, token)
      .send({
        parts: [1, 2, 3].map((n) => ({ part_number: n, etag: etags.get(n) })),
      })
      .expect(202);

    expect(res.body).toEqual({
      public_id: publicId,
      status: 'draft',
      processing_status: 'processing',
      size_bytes: TWELVE_MIB,
    });
    await expect(
      storageService.headObject(`videos/${publicId}/source`),
    ).resolves.toEqual({
      contentLength: TWELVE_MIB,
      contentType: 'video/mp4',
    });

    const video = await videoRepository.findOneByOrFail({
      public_id: publicId,
    });
    expect(video.processing_status).toBe('processing');
    expect(video.size_bytes).toBe(TWELVE_MIB);
    const session = await uploadRepository.findOneByOrFail({
      video_id: video.id,
    });
    expect(session.state).toBe('completed');
    expect(session.completed_at).toBeInstanceOf(Date);

    const jobs = await videoProcessJobs(video.id);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      singleton_key: `video:${video.id}`,
      retry_limit: 3,
    });
  });

  test('3.2 complete-with-missing-part-is-rejected', async () => {
    const token = await authenticate('owner-missing@example.com');
    const { publicId } = await createUpload(token, TWELVE_MIB);
    const urls = await presign(token, publicId, [1, 2, 3]);
    const etags = await sendParts(urls, buffers(TWELVE_MIB), [1, 2]);

    const missing = await api
      .complete(publicId, token)
      .send({
        parts: [1, 2].map((n) => ({ part_number: n, etag: etags.get(n) })),
      })
      .expect(422);
    expect(errorBody(missing).error).toBe('UPLOAD_INCOMPLETE');

    const wrongEtag = await api
      .complete(publicId, token)
      .send({
        parts: [
          { part_number: 1, etag: etags.get(1) },
          { part_number: 2, etag: '"deadbeef"' },
          { part_number: 3, etag: '"deadbeef"' },
        ],
      })
      .expect(422);
    expect(errorBody(wrongEtag).error).toBe('UPLOAD_INCOMPLETE');

    const video = await videoRepository.findOneByOrFail({
      public_id: publicId,
    });
    expect(video.processing_status).toBe('uploading');
    expect(video.size_bytes).toBe(TWELVE_MIB);
    const session = await uploadRepository.findOneByOrFail({
      video_id: video.id,
    });
    expect(session.state).toBe('active');
    await expect(videoProcessJobs(video.id)).resolves.toEqual([]);
  });

  // ### 4. DELETE /videos/{publicId}/upload

  test('4.1 abort-removes-draft-and-multipart', async () => {
    const token = await authenticate('owner-abort@example.com');
    const { publicId, uploadId } = await createUpload(token, PART_SIZE);
    const urls = await presign(token, publicId, [1]);
    await sendParts(urls, buffers(PART_SIZE), [1]);

    const res = await api.abort(publicId, token).expect(204);
    expect(res.body).toEqual({});

    // GET /videos/{publicId} chega no SI-03.10; a rota de upload prova o mesmo 404 de domínio.
    const gone = await api.state(publicId, token).expect(404);
    expect(errorBody(gone).error).toBe('VIDEO_NOT_FOUND');

    await expect(
      storageService.listParts(`videos/${publicId}/source`, uploadId),
    ).resolves.toBeNull();
    await expect(
      listMultipartUploads(s3, bucket, `videos/${publicId}/`),
    ).resolves.toEqual([]);
    await expect(
      videoRepository.findOneBy({ public_id: publicId }),
    ).resolves.toBeNull();
    await expect(uploadRepository.count()).resolves.toBe(0);
  });

  test('4.2 completed-session-rejects-further-upload-operations', async () => {
    const token = await authenticate('owner-done@example.com');
    const { publicId } = await createUpload(token, PART_SIZE);
    const urls = await presign(token, publicId, [1]);
    const etags = await sendParts(urls, buffers(PART_SIZE), [1]);
    await api
      .complete(publicId, token)
      .send({ parts: [{ part_number: 1, etag: etags.get(1) }] })
      .expect(202);

    const parts = await api
      .parts(publicId, token)
      .send({ part_numbers: [1] })
      .expect(409);
    expect(errorBody(parts).error).toBe('UPLOAD_NOT_ACTIVE');
    const state = await api.state(publicId, token).expect(409);
    expect(errorBody(state).error).toBe('UPLOAD_NOT_ACTIVE');
    const abort = await api.abort(publicId, token).expect(409);
    expect(errorBody(abort).error).toBe('UPLOAD_NOT_ACTIVE');

    await expect(
      storageService.headObject(`videos/${publicId}/source`),
    ).resolves.toMatchObject({
      contentLength: PART_SIZE,
    });
  });

  // ### 5. Autorização nas rotas de upload

  test('5.1 non-owner-and-unknown-ids-are-rejected', async () => {
    const ownerToken = await authenticate('owner-auth@example.com');
    const intruderToken = await authenticate('intruder@example.com');
    const { publicId } = await createUpload(ownerToken, PART_SIZE);

    // supertest sobe o servidor por requisição (app.getHttpServer() não está ouvindo):
    // chamadas concorrentes no mesmo servidor resetam a conexão — por isso são sequenciais.
    const routes = (id: string, token?: string) => [
      () => api.parts(id, token).send({ part_numbers: [1] }),
      () => api.state(id, token),
      () => api.complete(id, token).send({ parts: [] }),
      () => api.abort(id, token),
    ];

    for (const call of routes(publicId, intruderToken)) {
      const res = await call();
      expect(res.status).toBe(403);
      expect(errorBody(res).error).toBe('VIDEO_FORBIDDEN');
    }

    for (const call of routes(UNKNOWN_ID, ownerToken)) {
      const res = await call();
      expect(res.status).toBe(404);
      expect(errorBody(res).error).toBe('VIDEO_NOT_FOUND');
    }

    for (const call of routes(publicId)) {
      const res = await call();
      expect(res.status).toBe(401);
    }

    const video = await videoRepository.findOneByOrFail({
      public_id: publicId,
    });
    const session = await uploadRepository.findOneByOrFail({
      video_id: video.id,
    });
    expect(session.state).toBe('active');
  });
});
