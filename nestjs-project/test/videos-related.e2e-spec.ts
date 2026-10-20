// Generated from specs/videos-related.plan.md (SI-05.6 — phase-05-watch-page).
// One describe per spec; one test per scenario; group headings kept as comments.
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Channel } from '../src/channels/entities/channel.entity';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { MailService } from '../src/mail/mail.service';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { User } from '../src/users/entities/user.entity';
import { Video } from '../src/videos/entities/video.entity';
import { generatePublicId, storageKeys } from '../src/videos/public-id.util';
import type {
  VideoProcessingStatus,
  VideoStatus,
  VideoVisibility,
} from '../src/videos/videos.constants';

const PASSWORD = 'password123';
const BASE = Date.parse('2026-10-01T12:00:00.000Z');
const minutes = (n: number) => new Date(BASE + n * 60_000);

type ErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
};

type RelatedItem = {
  public_id: string;
  title: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  view_count: number;
  published_at: string | null;
  channel: { nickname: string; name: string };
};

type RelatedBody = { items: RelatedItem[] };

type SeedState = {
  title: string;
  category?: string | null;
  status?: VideoStatus;
  visibility?: VideoVisibility;
  processing_status?: VideoProcessingStatus;
  published_at?: Date | null;
};

describe('videos-related', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let mailService: MailService;
  let throttlerStorage: ThrottlerStorageService;
  let categories: Map<string, string>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
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
    mailService = moduleFixture.get(MailService);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
    // Categories are seeded by the SeedCategories migration; cleanAllTables keeps them.
    const rows = await dataSource.query<{ id: string; slug: string }[]>(
      `SELECT "id", "slug" FROM "categories"`,
    );
    categories = new Map(rows.map((row) => [row.slug, row.id]));
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    throttlerStorage.storage.clear();
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

  /** Canal criado no cadastro de `email`. */
  async function channelOf(email: string): Promise<Channel> {
    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email });
    return dataSource
      .getRepository(Channel)
      .findOneByOrFail({ user_id: user.id });
  }

  /**
   * Insere o vídeo direto no repositório: os cenários semeiam até 16 vídeos, e 16 `POST /videos`
   * estourariam o throttler global (10/min por rota) sem nada a acrescentar a este endpoint.
   */
  async function seedVideo(
    channel: Channel,
    state: SeedState,
  ): Promise<string> {
    const publicId = generatePublicId();
    const status = state.status ?? 'published';
    await videoRepository.save(
      videoRepository.create({
        public_id: publicId,
        channel_id: channel.id,
        title: state.title,
        original_filename: 'aula.mp4',
        content_type: 'video/mp4',
        storage_key: storageKeys(publicId).source,
        status,
        visibility: state.visibility ?? 'public',
        processing_status: state.processing_status ?? 'ready',
        category_id: state.category ? categories.get(state.category)! : null,
        published_at:
          state.published_at ?? (status === 'published' ? new Date() : null),
      }),
    );
    return publicId;
  }

  async function getRelated(
    publicId: string,
    query: Record<string, string> = {},
    token?: string,
  ): Promise<request.Response> {
    const req = request(app.getHttpServer())
      .get(`/videos/${publicId}/related`)
      .query(query);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  // 1. Seleção das sugestões

  it('same-category-first-then-recent-fill', async () => {
    await authenticate('criador@example.com');
    const channel = await channelOf('criador@example.com');
    const origin = await seedVideo(channel, {
      title: 'origin',
      category: 'music',
      published_at: minutes(0),
    });
    for (const n of [1, 2, 3]) {
      await seedVideo(channel, {
        title: `music-${n}`,
        category: 'music',
        published_at: minutes(n),
      });
    }
    for (let n = 1; n <= 12; n++) {
      await seedVideo(channel, {
        title: `gaming-${n}`,
        category: 'gaming',
        published_at: minutes(100 + n),
      });
    }

    const res = await getRelated(origin);

    expect(res.status).toBe(200);
    const body = res.body as RelatedBody;
    expect(Object.keys(body)).toEqual(['items']);
    expect(body.items.map((item) => item.title)).toEqual([
      'music-3',
      'music-2',
      'music-1',
      ...[12, 11, 10, 9, 8, 7, 6, 5, 4].map((n) => `gaming-${n}`),
    ]);
    expect(new Set(body.items.map((item) => item.public_id)).size).toBe(12);
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual(
        [
          'channel',
          'duration_seconds',
          'published_at',
          'public_id',
          'thumbnail_url',
          'title',
          'view_count',
        ].sort(),
      );
      expect(item.channel).toEqual({
        nickname: channel.nickname,
        name: channel.name,
      });
    }

    const limited = await getRelated(origin, { limit: '2' });

    expect(limited.status).toBe(200);
    expect((limited.body as RelatedBody).items.map((i) => i.title)).toEqual([
      'music-3',
      'music-2',
    ]);
  });

  it('excludes-self-unlisted-drafts-and-not-ready', async () => {
    await authenticate('criador@example.com');
    const channel = await channelOf('criador@example.com');
    const origin = await seedVideo(channel, {
      title: 'origin',
      category: 'music',
    });
    await seedVideo(channel, {
      title: 'unlisted',
      category: 'music',
      visibility: 'unlisted',
    });
    await seedVideo(channel, {
      title: 'draft',
      category: 'music',
      status: 'draft',
    });
    await seedVideo(channel, {
      title: 'processing',
      category: 'music',
      processing_status: 'processing',
    });
    const ready = await seedVideo(channel, {
      title: 'ready',
      category: 'music',
    });

    const res = await getRelated(origin);

    expect(res.status).toBe(200);
    expect((res.body as RelatedBody).items.map((i) => i.public_id)).toEqual([
      ready,
    ]);

    const withoutCategory = await seedVideo(channel, {
      title: 'no-category',
      category: null,
    });

    const fallback = await getRelated(withoutCategory);

    expect(fallback.status).toBe(200);
    const ids = (fallback.body as RelatedBody).items.map((i) => i.public_id);
    expect(ids).toEqual(expect.arrayContaining([origin, ready]));
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain(withoutCategory);
  });

  // 2. Validação e autorização

  it('limit-out-of-range-returns-400', async () => {
    await authenticate('criador@example.com');
    const channel = await channelOf('criador@example.com');
    const origin = await seedVideo(channel, { title: 'origin' });

    const tooHigh = await getRelated(origin, { limit: '30' });
    const zero = await getRelated(origin, { limit: '0' });

    expect(tooHigh.status).toBe(400);
    expect((tooHigh.body as ErrorBody).error).toBe('VALIDATION_ERROR');
    expect(zero.status).toBe(400);
    expect((zero.body as ErrorBody).error).toBe('VALIDATION_ERROR');
  });

  it('draft-origin-returns-404-for-anonymous', async () => {
    const token = await authenticate('rascunho@example.com');
    const channel = await channelOf('rascunho@example.com');
    const draft = await seedVideo(channel, {
      title: 'draft',
      status: 'draft',
    });

    const anonymous = await getRelated(draft);
    const owner = await getRelated(draft, {}, token);

    expect(anonymous.status).toBe(404);
    expect((anonymous.body as ErrorBody).error).toBe('VIDEO_NOT_FOUND');
    expect(owner.status).toBe(200);
    expect(owner.body).toEqual({ items: [] });
  });
});
