// Generated from specs/videos-create.plan.md (SI-03.5 — phase-03-upload-processing).
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
import { abortAllMultipart, listMultipartUploads } from '../src/test/storage';
import { Channel } from '../src/channels/entities/channel.entity';
import { User } from '../src/users/entities/user.entity';
import { VideoUpload } from '../src/videos/entities/video-upload.entity';
import { Video } from '../src/videos/entities/video.entity';

const PASSWORD = 'password123';
const MIB = 1024 * 1024;
const PART_SIZE = 5 * MIB;
const MAX_BYTES = 10 * 1024 * MIB;
const QUEUE_SCHEMA = process.env.QUEUE_SCHEMA ?? 'pgboss';

type ErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
};

function errorBody(res: request.Response): ErrorBody {
  return res.body as ErrorBody;
}

describe('videos-create', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let uploadRepository: Repository<VideoUpload>;
  let storageService: StorageService;
  let s3: S3Client;
  let bucket: string;
  let mailService: MailService;
  let throttlerStorage: ThrottlerStorageService;

  beforeAll(async () => {
    // A suíte roda dentro do container: a assinatura SigV4 fixa o host, e localhost:9000 é o
    // próprio container — o cliente "público" precisa apontar para o host interno alcançável.
    process.env.UPLOAD_PART_SIZE = String(PART_SIZE);
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
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    throttlerStorage.storage.clear();
    await abortAllMultipart(s3, bucket, 'videos/');
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

  function post(token?: string) {
    const req = request(app.getHttpServer()).post('/videos');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  // ### 1. POST /videos

  test('1.1 valid-declaration-creates-draft-and-multipart', async () => {
    const token = await authenticate('owner-create@example.com');

    const res = await post(token)
      .send({
        original_filename: 'a.mp4',
        content_type: 'video/mp4',
        size_bytes: 15728640,
      })
      .expect(201);

    expect(res.body.public_id).toMatch(/^[A-Za-z0-9_-]{11}$/);
    expect(res.body.status).toBe('draft');
    expect(res.body.processing_status).toBe('uploading');
    expect(res.body.upload.upload_id).toEqual(expect.any(String));
    expect(res.body.upload.upload_id).not.toBe('');
    expect(res.body.upload.part_size).toBe(PART_SIZE);
    expect(res.body.upload.part_count).toBe(3);
    expect(new Date(res.body.upload.expires_at).getTime()).toBeGreaterThan(
      Date.now(),
    );

    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email: 'owner-create@example.com' });
    const channel = await dataSource
      .getRepository(Channel)
      .findOneByOrFail({ user_id: user.id });
    const video = await videoRepository.findOneByOrFail({
      public_id: res.body.public_id,
    });
    expect(video.channel_id).toBe(channel.id);
    expect(video.storage_key).toBe(`videos/${res.body.public_id}/source`);
    expect(video.content_type).toBe('video/mp4');
    expect(video.size_bytes).toBe(15728640);

    const session = await uploadRepository.findOneByOrFail({
      video_id: video.id,
    });
    expect(session.state).toBe('active');
    expect(session.upload_id).toBe(res.body.upload.upload_id);
    expect(session.part_count).toBe(3);
    expect(session.expected_bytes).toBe(15728640);

    await expect(
      storageService.listParts(video.storage_key, session.upload_id),
    ).resolves.toEqual([]);
  });

  // Phase 04 (SI-04.2 acceptance): the draft exposes the editorial defaults on GET /videos/{id}.
  test('phase-04 new-draft-exposes-title-and-editorial-defaults', async () => {
    const token = await authenticate('owner-defaults@example.com');

    const created = await post(token)
      .send({
        original_filename: 'Minha aula.final.mp4',
        content_type: 'video/mp4',
        size_bytes: 15728640,
      })
      .expect(201);

    const { public_id: publicId } = created.body as { public_id: string };
    const res = await request(app.getHttpServer())
      .get(`/videos/${publicId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      title: 'Minha aula.final',
      description: null,
      status: 'draft',
      visibility: 'public',
      category: null,
      view_count: 0,
      like_count: 0,
      dislike_count: 0,
      comment_count: 0,
      published_at: null,
      has_custom_thumbnail: false,
    });
  });

  test('1.2 unsupported-media-type-is-rejected-before-storage', async () => {
    const token = await authenticate('owner-mkv@example.com');

    const res = await post(token)
      .send({
        original_filename: 'a.mkv',
        content_type: 'video/x-matroska',
        size_bytes: 1048576,
      })
      .expect(400);

    expect(errorBody(res)).toMatchObject({
      statusCode: 400,
      error: 'VIDEO_UNSUPPORTED_MEDIA_TYPE',
    });
    expect(typeof errorBody(res).message).toBe('string');
    await expect(videoRepository.count()).resolves.toBe(0);
    await expect(listMultipartUploads(s3, bucket, 'videos/')).resolves.toEqual(
      [],
    );
  });

  test('1.3 size-above-limit-returns-too-large', async () => {
    const token = await authenticate('owner-big@example.com');

    const res = await post(token)
      .send({
        original_filename: 'big.mp4',
        content_type: 'video/mp4',
        size_bytes: MAX_BYTES + 1,
      })
      .expect(413);

    expect(errorBody(res).error).toBe('VIDEO_TOO_LARGE');
    await expect(videoRepository.count()).resolves.toBe(0);
    await expect(uploadRepository.count()).resolves.toBe(0);
  });

  test('1.4 unauthenticated-or-invalid-body-is-rejected', async () => {
    const token = await authenticate('owner-auth@example.com');

    await post()
      .send({
        original_filename: 'a.mp4',
        content_type: 'video/mp4',
        size_bytes: 1024,
      })
      .expect(401);

    const missing = await post(token)
      .send({ original_filename: 'a.mp4', content_type: 'video/mp4' })
      .expect(400);
    expect(errorBody(missing).error).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(errorBody(missing).message)).toContain('size_bytes');

    await post(token)
      .send({
        original_filename: 'a.mp4',
        content_type: 'video/mp4',
        size_bytes: 1024,
        extra: true,
      })
      .expect(400);

    await expect(videoRepository.count()).resolves.toBe(0);
  });

  test('1.5 expiration-job-is-scheduled-with-session', async () => {
    const token = await authenticate('owner-expire@example.com');

    const res = await post(token)
      .send({
        original_filename: 'a.webm',
        content_type: 'video/webm',
        size_bytes: 6291456,
      })
      .expect(201);

    const video = await videoRepository.findOneByOrFail({
      public_id: res.body.public_id,
    });
    const jobs = await dataSource.query<
      { state: string; singleton_key: string; start_after: Date }[]
    >(
      `SELECT state, singleton_key, start_after FROM "${QUEUE_SCHEMA}"."job"
       WHERE name = 'upload.expire' AND data->>'videoId' = $1`,
      [video.id],
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0].state).toBe('created');
    expect(jobs[0].singleton_key).toBe(`upload:${video.id}`);
    const expiresAt = new Date(res.body.upload.expires_at).getTime();
    expect(
      Math.abs(new Date(jobs[0].start_after).getTime() - expiresAt),
    ).toBeLessThan(1000);

    const session = await uploadRepository.findOneByOrFail({
      video_id: video.id,
    });
    expect(session.state).toBe('active');
    expect(session.expires_at.getTime()).toBe(expiresAt);
  });

  test('1.6 two-uploads-get-distinct-ids-and-sessions', async () => {
    const token = await authenticate('owner-two@example.com');
    const payload = {
      original_filename: 'a.mp4',
      content_type: 'video/mp4',
      size_bytes: PART_SIZE,
    };

    const first = await post(token).send(payload).expect(201);
    const second = await post(token).send(payload).expect(201);

    expect(first.body.public_id).not.toBe(second.body.public_id);
    expect(first.body.upload.upload_id).not.toBe(second.body.upload.upload_id);

    const videos = await videoRepository.find({ order: { created_at: 'ASC' } });
    expect(videos.map((video) => video.storage_key).sort()).toEqual(
      [
        `videos/${first.body.public_id}/source`,
        `videos/${second.body.public_id}/source`,
      ].sort(),
    );
    await expect(uploadRepository.count()).resolves.toBe(2);
    for (const video of videos) {
      const session = await uploadRepository.findOneByOrFail({
        video_id: video.id,
      });
      await expect(
        storageService.listParts(video.storage_key, session.upload_id),
      ).resolves.not.toBeNull();
    }
  });
});
