// Generated from specs/videos-get.plan.md (SI-05.2 — phase-05-watch-page).
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
  VideoProcessingStatus,
  VideoStatus,
} from '../src/videos/videos.constants';

const PASSWORD = 'password123';
const MIB = 1024 * 1024;

type ErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
};

type ChannelBody = { nickname: string; name: string };

type VideoBody = {
  public_id: string;
  status: VideoStatus;
  visibility: 'public' | 'unlisted';
  title: string;
  view_count: number;
  channel?: Record<string, unknown>;
};

describe('videos-get', () => {
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

  /** Canal do usuário autenticado (`GET /channels/me`) — nickname e nome esperados em `channel`. */
  async function ownChannel(token: string): Promise<ChannelBody> {
    const res = await request(app.getHttpServer())
      .get('/channels/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const { nickname, name } = res.body as ChannelBody;
    return { nickname, name };
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

  // ### 1. Leitura pública com o canal

  test('1.1 anonymous-reads-published-video-with-channel', async () => {
    const token = await authenticate('canal@example.com');
    const channel = await ownChannel(token);
    const publicId = await seedVideo(token, {
      status: 'published',
      processing_status: 'ready',
    });

    const res = await request(app.getHttpServer())
      .get(`/videos/${publicId}`)
      .expect(200);
    const body = res.body as VideoBody;

    // Fase 06 (social-interactions/TD-04): o canal embutido ganhou inscritos e o estado do espectador.
    expect(body.channel).toEqual({
      nickname: channel.nickname,
      name: channel.name,
      subscriber_count: 0,
      viewer_subscribed: false,
    });
    expect(body).toMatchObject({
      public_id: publicId,
      status: 'published',
      visibility: 'public',
      view_count: 0,
    });
  });

  test('1.2 owner-patch-response-carries-channel', async () => {
    const token = await authenticate('dono@example.com');
    const channel = await ownChannel(token);
    const publicId = await seedVideo(token, {
      status: 'draft',
      processing_status: 'ready',
    });

    const res = await request(app.getHttpServer())
      .patch(`/videos/${publicId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Novo título' })
      .expect(200);
    const body = res.body as VideoBody;

    expect(body.title).toBe('Novo título');
    expect(body.channel?.nickname).toBe(channel.nickname);
  });

  // ### 2. Regra de leitura inalterada

  test('2.1 anonymous-gets-404-for-draft', async () => {
    const token = await authenticate('rascunho@example.com');
    const publicId = await seedVideo(token, {
      status: 'draft',
      processing_status: 'ready',
    });

    const res = await request(app.getHttpServer())
      .get(`/videos/${publicId}`)
      .expect(404);
    const body = res.body as ErrorBody & Record<string, unknown>;

    expect(body.error).toBe('VIDEO_NOT_FOUND');
    expect(body).not.toHaveProperty('channel');
    expect(body).not.toHaveProperty('public_id');
  });
});
