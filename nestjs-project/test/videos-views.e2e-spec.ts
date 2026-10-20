// Generated from specs/videos-views.plan.md (SI-05.4 — phase-05-watch-page).
// One describe per spec; one test per scenario; group headings kept as comments.
import type { S3Client } from '@aws-sdk/client-s3';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { MailService } from '../src/mail/mail.service';
import { S3_INTERNAL_CLIENT } from '../src/storage/storage.constants';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { abortAllMultipart } from '../src/test/storage';
import { VideoView } from '../src/videos/entities/video-view.entity';
import { Video } from '../src/videos/entities/video.entity';
import type {
  VideoProcessingStatus,
  VideoStatus,
} from '../src/videos/videos.constants';

const PASSWORD = 'password123';
const MIB = 1024 * 1024;
const USER_AGENT = 'e2e-agent';

type ErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
};

describe('videos-views', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let viewRepository: Repository<VideoView>;
  let s3: S3Client;
  let bucket: string;
  let mailService: MailService;
  let throttlerStorage: ThrottlerStorageService;

  beforeAll(async () => {
    process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    // Reproduces main.ts — the testing module does not run it. Supertest connects over loopback,
    // so trusting loopback lets X-Forwarded-For define req.ip (TRUST_PROXY in production).
    app.set('trust proxy', 'loopback');
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
    viewRepository = dataSource.getRepository(VideoView);
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

  /** `POST /videos` + status/processamento semeados direto no banco (sem worker). */
  async function seedVideo(
    token: string,
    state: { status: VideoStatus; processing_status: VideoProcessingStatus },
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        original_filename: 'aula.mp4',
        content_type: 'video/mp4',
        size_bytes: MIB,
      })
      .expect(201);
    const publicId = (res.body as { public_id: string }).public_id;
    await videoRepository.update(
      { public_id: publicId },
      {
        status: state.status,
        processing_status: state.processing_status,
        published_at: state.status === 'published' ? new Date() : null,
      },
    );
    return publicId;
  }

  async function viewCount(publicId: string): Promise<number> {
    const video = await videoRepository.findOneByOrFail({
      public_id: publicId,
    });
    return video.view_count;
  }

  function view(publicId: string, forwardedFor: string, token?: string) {
    const req = request(app.getHttpServer())
      .post(`/videos/${publicId}/views`)
      .set('X-Forwarded-For', forwardedFor)
      .set('User-Agent', USER_AGENT);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  // ### 1. Contagem e deduplicação

  test('1.1 anonymous-view-counts-once-per-day', async () => {
    const token = await authenticate('canal@example.com');
    const publicId = await seedVideo(token, {
      status: 'published',
      processing_status: 'ready',
    });
    expect(await viewCount(publicId)).toBe(0);

    const first = await view(publicId, '203.0.113.10').expect(204);
    expect(first.text).toBe('');
    expect(await viewCount(publicId)).toBe(1);
    const read = await request(app.getHttpServer())
      .get(`/videos/${publicId}`)
      .expect(200);
    expect((read.body as { view_count: number }).view_count).toBe(1);

    await view(publicId, '203.0.113.10').expect(204);
    expect(await viewCount(publicId)).toBe(1);
    const video = await videoRepository.findOneByOrFail({
      public_id: publicId,
    });
    expect(await viewRepository.countBy({ video_id: video.id })).toBe(1);

    await view(publicId, '203.0.113.11').expect(204);
    expect(await viewCount(publicId)).toBe(2);
  });

  test('1.2 distinct-authenticated-users-count-separately', async () => {
    const ownerToken = await authenticate('canal@example.com');
    const publicId = await seedVideo(ownerToken, {
      status: 'published',
      processing_status: 'ready',
    });
    const ana = await authenticate('ana@example.com');
    const bia = await authenticate('bia@example.com');

    await view(publicId, '203.0.113.20', ana).expect(204);
    await view(publicId, '203.0.113.20', bia).expect(204);

    expect(await viewCount(publicId)).toBe(2);
    const keys = (await viewRepository.find()).map((row) => row.viewer_key);
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => key.startsWith('user:'))).toBe(true);
    expect(new Set(keys).size).toBe(2);
  });

  test('1.3 stored-viewer-keys-never-contain-raw-ip', async () => {
    const token = await authenticate('canal@example.com');
    const publicId = await seedVideo(token, {
      status: 'published',
      processing_status: 'ready',
    });

    await view(publicId, '198.51.100.77').expect(204);

    const rows = await dataSource.query<{ viewer_key: string }[]>(
      'SELECT "viewer_key" FROM "video_views"',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].viewer_key).toMatch(/^anon:[0-9a-f]{64}$/);
    expect(rows.some((row) => row.viewer_key.includes('198.51.100.77'))).toBe(
      false,
    );
  });

  // ### 2. Dono e rascunhos

  test('2.1 owner-view-returns-204-without-counting', async () => {
    const token = await authenticate('dono@example.com');
    const published = await seedVideo(token, {
      status: 'published',
      processing_status: 'ready',
    });
    const draft = await seedVideo(token, {
      status: 'draft',
      processing_status: 'ready',
    });

    await view(published, '203.0.113.30', token).expect(204);
    await view(draft, '203.0.113.30', token).expect(204);

    expect(await viewCount(published)).toBe(0);
    expect(await viewCount(draft)).toBe(0);
    expect(await viewRepository.count()).toBe(0);
  });

  test('2.2 anonymous-view-on-draft-returns-404', async () => {
    const token = await authenticate('rascunho@example.com');
    const publicId = await seedVideo(token, {
      status: 'draft',
      processing_status: 'ready',
    });

    const res = await view(publicId, '203.0.113.40').expect(404);

    expect((res.body as ErrorBody).error).toBe('VIDEO_NOT_FOUND');
    expect(await viewRepository.count()).toBe(0);
  });
});
