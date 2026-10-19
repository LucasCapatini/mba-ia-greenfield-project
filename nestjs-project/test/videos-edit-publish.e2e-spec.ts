// Generated from specs/videos-edit-publish.plan.md (SI-04.4 — phase-04-video-channel-management).
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
import { SeedCategories1792416144429 } from '../src/database/migrations/1792416144429-SeedCategories';
import { MailService } from '../src/mail/mail.service';
import { S3_INTERNAL_CLIENT } from '../src/storage/storage.constants';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { abortAllMultipart } from '../src/test/storage';
import { Video } from '../src/videos/entities/video.entity';
import type { VideoProcessingStatus } from '../src/videos/videos.constants';

const PASSWORD = 'password123';
const MIB = 1024 * 1024;
const UNKNOWN_ID = 'AAAAAAAAAAA';
const UNKNOWN_CATEGORY = '00000000-0000-4000-8000-000000000000';

type ErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
};

type VideoBody = {
  public_id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'published';
  visibility: 'public' | 'unlisted';
  published_at: string | null;
  category: {
    id: string;
    slug: string;
    name: string;
    sort_order: number;
  } | null;
};

type CategoryBody = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
};

function errorBody(res: request.Response): ErrorBody {
  return res.body as ErrorBody;
}

function videoBody(res: request.Response): VideoBody {
  return res.body as VideoBody;
}

describe('videos-edit-publish', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let s3: S3Client;
  let bucket: string;
  let mailService: MailService;
  let throttlerStorage: ThrottlerStorageService;
  let categories: CategoryBody[];

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

    // `categories` is platform data from the SI-04.1 data migration; the seed is idempotent and
    // `cleanAllTables` never truncates it.
    const queryRunner = dataSource.createQueryRunner();
    try {
      await new SeedCategories1792416144429().up(queryRunner);
    } finally {
      await queryRunner.release();
    }
    const res = await request(app.getHttpServer())
      .get('/categories')
      .expect(200);
    categories = res.body as CategoryBody[];
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

  /** `POST /videos` + estado de processamento semeado direto no banco (sem worker). */
  async function seedVideo(
    token: string,
    state: VideoProcessingStatus,
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
    if (state !== 'uploading') {
      await videoRepository.update(
        { public_id: publicId },
        { processing_status: state },
      );
    }
    return publicId;
  }

  const api = {
    get: (id: string, token?: string) => {
      const req = request(app.getHttpServer()).get(`/videos/${id}`);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    },
    patch: (id: string, token?: string) => {
      const req = request(app.getHttpServer()).patch(`/videos/${id}`);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    },
    publish: (id: string, token?: string) => {
      const req = request(app.getHttpServer()).post(`/videos/${id}/publish`);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    },
    unpublish: (id: string, token?: string) => {
      const req = request(app.getHttpServer()).post(`/videos/${id}/unpublish`);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    },
  };

  // ### 1. PATCH /videos/{publicId}

  test('1.1 owner-edits-editorial-fields-without-changing-status', async () => {
    const token = await authenticate('editor@example.com');
    const publicId = await seedVideo(token, 'ready');
    const music = categories.find((category) => category.slug === 'music')!;

    const first = await api
      .patch(publicId, token)
      .send({ title: 'Novo', visibility: 'unlisted' })
      .expect(200);
    expect(videoBody(first)).toMatchObject({
      title: 'Novo',
      visibility: 'unlisted',
      status: 'draft',
      published_at: null,
    });

    const second = await api
      .patch(publicId, token)
      .send({ description: 'Descrição', category_id: music.id })
      .expect(200);
    expect(videoBody(second).description).toBe('Descrição');
    expect(videoBody(second).category).toEqual({
      id: music.id,
      slug: 'music',
      name: 'Music',
      sort_order: 1,
    });

    const read = await api.get(publicId, token).expect(200);
    expect(videoBody(read)).toMatchObject({
      title: 'Novo',
      description: 'Descrição',
      visibility: 'unlisted',
      category: { id: music.id, slug: 'music' },
    });
  });

  test('1.2 invalid-bodies-are-rejected', async () => {
    const token = await authenticate('invalid-edit@example.com');
    const publicId = await seedVideo(token, 'ready');

    const empty = await api.patch(publicId, token).send({}).expect(400);
    expect(errorBody(empty).error).toBe('VALIDATION_ERROR');

    const blankTitle = await api
      .patch(publicId, token)
      .send({ title: '' })
      .expect(400);
    expect(errorBody(blankTitle).error).toBe('VALIDATION_ERROR');

    const unknownCategory = await api
      .patch(publicId, token)
      .send({ category_id: UNKNOWN_CATEGORY })
      .expect(400);
    expect(errorBody(unknownCategory).error).toBe('CATEGORY_NOT_FOUND');

    const status = await api
      .patch(publicId, token)
      .send({ status: 'published' })
      .expect(400);
    expect(errorBody(status).error).toBe('VALIDATION_ERROR');

    const read = await api.get(publicId, token).expect(200);
    expect(videoBody(read)).toMatchObject({
      title: 'aula',
      status: 'draft',
      category: null,
    });
  });

  // ### 2. POST /videos/{publicId}/publish e /unpublish

  test('2.1 publish-requires-ready-and-title', async () => {
    const token = await authenticate('publisher@example.com');

    const processing = await seedVideo(token, 'processing');
    const notReady = await api.publish(processing, token).expect(409);
    expect(errorBody(notReady).error).toBe('VIDEO_NOT_PUBLISHABLE');
    expect(videoBody(await api.get(processing, token).expect(200)).status).toBe(
      'draft',
    );

    const untitled = await seedVideo(token, 'ready');
    await videoRepository.update({ public_id: untitled }, { title: '' });
    const noTitle = await api.publish(untitled, token).expect(409);
    expect(errorBody(noTitle).error).toBe('VIDEO_NOT_PUBLISHABLE');

    const ready = await seedVideo(token, 'ready');
    const published = await api.publish(ready, token).expect(200);
    expect(videoBody(published).status).toBe('published');
    const publishedAt = videoBody(published).published_at;
    expect(publishedAt).not.toBeNull();
    expect(new Date(publishedAt!).toISOString()).toBe(publishedAt);

    const again = await api.publish(ready, token).expect(200);
    expect(videoBody(again).published_at).toBe(publishedAt);
  });

  test('2.2 unpublish-preserves-visibility-and-published-at', async () => {
    const token = await authenticate('unpublisher@example.com');
    const publicId = await seedVideo(token, 'ready');
    await api
      .patch(publicId, token)
      .send({ visibility: 'unlisted' })
      .expect(200);
    const published = await api.publish(publicId, token).expect(200);
    expect(videoBody(published).status).toBe('published');
    const publishedAt = videoBody(published).published_at;

    const unpublished = await api.unpublish(publicId, token).expect(200);
    expect(videoBody(unpublished)).toMatchObject({
      status: 'draft',
      visibility: 'unlisted',
      published_at: publishedAt,
    });

    const again = await api.unpublish(publicId, token).expect(200);
    expect(videoBody(again).status).toBe('draft');

    const republished = await api.publish(publicId, token).expect(200);
    expect(videoBody(republished).published_at).toBe(publishedAt);
  });

  // ### 3. Autorização nas três rotas

  test('3.1 non-owner-anonymous-and-unknown-are-rejected', async () => {
    const ownerToken = await authenticate('owner-edit@example.com');
    const intruderToken = await authenticate('intruder-edit@example.com');
    const publicId = await seedVideo(ownerToken, 'ready');

    // Sequencial: requisições concorrentes contra o servidor do supertest resetam a conexão.
    const patch = await api
      .patch(publicId, intruderToken)
      .send({ title: 'x' })
      .expect(403);
    expect(errorBody(patch).error).toBe('VIDEO_FORBIDDEN');
    const publish = await api.publish(publicId, intruderToken).expect(403);
    expect(errorBody(publish).error).toBe('VIDEO_FORBIDDEN');
    const unpublish = await api.unpublish(publicId, intruderToken).expect(403);
    expect(errorBody(unpublish).error).toBe('VIDEO_FORBIDDEN');

    const read = await api.get(publicId, ownerToken).expect(200);
    expect(videoBody(read)).toMatchObject({ title: 'aula', status: 'draft' });

    await api.patch(publicId).send({ title: 'x' }).expect(401);
    await api.publish(publicId).expect(401);
    await api.unpublish(publicId).expect(401);

    const unknown = await api
      .patch(UNKNOWN_ID, ownerToken)
      .send({ title: 'x' })
      .expect(404);
    expect(errorBody(unknown).error).toBe('VIDEO_NOT_FOUND');
  });
});
