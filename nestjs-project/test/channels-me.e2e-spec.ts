// Generated from specs/channels-me.plan.md (SI-04.7 — phase-04-video-channel-management).
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
import { cleanAllTables } from '../src/test/create-test-data-source';
import { abortAllMultipart } from '../src/test/storage';
import { Video } from '../src/videos/entities/video.entity';
import type {
  VideoStatus,
  VideoVisibility,
} from '../src/videos/videos.constants';

const PASSWORD = 'password123';
const MIB = 1024 * 1024;

type ErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
};

type ChannelBody = {
  id: string;
  nickname: string;
  name: string;
  description: string | null;
  video_count: number;
  created_at: string;
  updated_at: string;
};

function errorBody(res: request.Response): ErrorBody {
  return res.body as ErrorBody;
}

function channelBody(res: request.Response): ChannelBody {
  return res.body as ChannelBody;
}

describe('channels-me', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
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

  /** `POST /videos` + estado editorial semeado direto no banco. */
  async function seedVideo(
    token: string,
    state: { status: VideoStatus; visibility: VideoVisibility },
  ): Promise<void> {
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
        processing_status: 'ready',
        status: state.status,
        visibility: state.visibility,
        published_at: state.status === 'published' ? new Date() : null,
      },
    );
  }

  const api = {
    me: (token?: string) => {
      const req = request(app.getHttpServer()).get('/channels/me');
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    },
    patchMe: (token?: string) => {
      const req = request(app.getHttpServer()).patch('/channels/me');
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    },
    channel: (nickname: string) =>
      request(app.getHttpServer()).get(`/channels/${nickname}`),
  };

  // ### 1. Leitura do próprio canal

  test('1.1 me-returns-own-channel-and-requires-auth', async () => {
    const token = await authenticate('canal_a@example.com');

    const res = await api.me(token).expect(200);
    const body = channelBody(res);
    expect(body).toMatchObject({
      nickname: 'canal_a',
      name: 'canal_a',
      description: null,
      video_count: 0,
    });
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(body.created_at).toISOString()).toBe(body.created_at);
    expect(new Date(body.updated_at).toISOString()).toBe(body.updated_at);

    await api.me().expect(401);
    await api.patchMe().send({ name: 'x' }).expect(401);
  });

  // ### 2. Edição do canal e política de nickname

  test('2.1 changing-nickname-moves-the-public-url', async () => {
    const tokenA = await authenticate('canal_a@example.com');
    const tokenB = await authenticate('canal_b@example.com');
    const before = channelBody(await api.me(tokenA).expect(200));

    const updated = await api
      .patchMe(tokenA)
      .send({
        nickname: 'novo_nick',
        name: 'Canal Novo',
        description: 'Sobre o canal',
      })
      .expect(200);
    expect(channelBody(updated)).toMatchObject({
      nickname: 'novo_nick',
      name: 'Canal Novo',
      description: 'Sobre o canal',
    });
    expect(new Date(channelBody(updated).updated_at).getTime()).toBeGreaterThan(
      new Date(before.updated_at).getTime(),
    );

    const moved = await api.channel('novo_nick').expect(200);
    expect(channelBody(moved)).toMatchObject({
      nickname: 'novo_nick',
      name: 'Canal Novo',
    });

    const old = await api.channel('canal_a').expect(404);
    expect(errorBody(old).error).toBe('CHANNEL_NOT_FOUND');

    const claimed = await api
      .patchMe(tokenB)
      .send({ nickname: 'canal_a' })
      .expect(200);
    expect(channelBody(claimed).nickname).toBe('canal_a');
  });

  test('2.2 taken-reserved-and-malformed-nicknames-are-rejected', async () => {
    const tokenA = await authenticate('canal_a@example.com');
    await authenticate('canal_b@example.com');

    const taken = await api
      .patchMe(tokenA)
      .send({ nickname: 'canal_b' })
      .expect(409);
    expect(errorBody(taken).error).toBe('NICKNAME_TAKEN');

    const reserved = await api
      .patchMe(tokenA)
      .send({ nickname: 'admin' })
      .expect(400);
    expect(errorBody(reserved).error).toBe('VALIDATION_ERROR');

    for (const nickname of ['Ab', '@canal']) {
      const malformed = await api
        .patchMe(tokenA)
        .send({ nickname })
        .expect(400);
      expect(errorBody(malformed).error).toBe('VALIDATION_ERROR');
    }

    for (const body of [{}, { name: '' }]) {
      const invalid = await api.patchMe(tokenA).send(body).expect(400);
      expect(errorBody(invalid).error).toBe('VALIDATION_ERROR');
    }

    const unchanged = await api.me(tokenA).expect(200);
    expect(channelBody(unchanged).nickname).toBe('canal_a');
  });

  // ### 3. Página pública do canal

  test('3.1 public-channel-counts-only-published-public-videos', async () => {
    const tokenA = await authenticate('canal_a@example.com');
    await seedVideo(tokenA, { status: 'published', visibility: 'public' });
    await seedVideo(tokenA, { status: 'published', visibility: 'public' });
    await seedVideo(tokenA, { status: 'published', visibility: 'unlisted' });
    await seedVideo(tokenA, { status: 'draft', visibility: 'public' });

    const res = await api.channel('canal_a').expect(200);
    const body = res.body as Record<string, unknown>;
    expect(body).toMatchObject({
      nickname: 'canal_a',
      name: 'canal_a',
      description: null,
      video_count: 2,
    });
    expect(Object.keys(body).sort()).toEqual([
      'created_at',
      'description',
      'name',
      'nickname',
      'subscriber_count',
      'video_count',
      'viewer_subscribed',
    ]);
    expect(JSON.stringify(body)).not.toContain('@example.com');

    const own = await api.me(tokenA).expect(200);
    expect(channelBody(own).video_count).toBe(2);

    const missing = await api.channel('nao_existe').expect(404);
    expect(errorBody(missing).error).toBe('CHANNEL_NOT_FOUND');
  });
});
