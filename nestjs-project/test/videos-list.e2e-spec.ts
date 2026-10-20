// Generated from specs/videos-list.plan.md (SI-07.2 — phase-07-home-search-production).
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

type CardItem = {
  public_id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  view_count: number;
  published_at: string | null;
  channel: { nickname: string; name: string };
};

type PageBody = { items: CardItem[]; next_cursor: string | null };

type SeedState = {
  title: string;
  category?: string | null;
  status?: VideoStatus;
  visibility?: VideoVisibility;
  processing_status?: VideoProcessingStatus;
  published_at?: Date | null;
};

describe('videos-list', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let mailService: MailService;
  let throttlerStorage: ThrottlerStorageService;
  let categories: Map<string, string>;
  let counter = 0;

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
    // Supertest connects over loopback: trusting it plays the role of TRUST_PROXY = <BFF IP>,
    // so X-Forwarded-For identifies the visitor for the throttler (watch-page/TD-03).
    app.set('trust proxy', 'loopback');
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

  /** Canal com nome/nickname controlados, direto nos repositórios (sem passar pelo cadastro). */
  async function createChannel(
    name: string,
    nickname: string,
  ): Promise<Channel> {
    const owner = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: `${nickname}@example.com`,
        password: 'hashed',
      }),
    );
    return dataSource
      .getRepository(Channel)
      .save(
        dataSource
          .getRepository(Channel)
          .create({ name, nickname, user_id: owner.id }),
      );
  }

  /** Insere o vídeo direto no repositório: os cenários semeiam até 22 vídeos. */
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
          state.published_at ??
          (status === 'published' ? minutes(++counter) : null),
      }),
    );
    return publicId;
  }

  function listVideos(
    query: Record<string, string> = {},
    token?: string,
  ): request.Test {
    const req = request(app.getHttpServer()).get('/videos').query(query);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  function titles(res: request.Response): string[] {
    return (res.body as PageBody).items.map((item) => item.title);
  }

  // 1. Listagem, ordem e paginação

  it('anonymous-lists-recent-public-ready-videos', async () => {
    const channel = await createChannel('Canal', 'canal_um');
    for (let n = 1; n <= 22; n++) {
      await seedVideo(channel, { title: `T${n}`, published_at: minutes(n) });
    }

    const res = await listVideos().expect(200);
    const body = res.body as PageBody;

    expect(titles(res)).toEqual(
      Array.from({ length: 20 }, (_, i) => `T${22 - i}`),
    );
    expect(body.next_cursor).toEqual(expect.any(String));
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
      expect(item.channel).toEqual({ nickname: 'canal_um', name: 'Canal' });
    }
  });

  it('cursor-returns-next-page-without-repeats', async () => {
    const channel = await createChannel('Canal', 'canal_um');
    for (let n = 1; n <= 22; n++) {
      await seedVideo(channel, { title: `T${n}`, published_at: minutes(n) });
    }

    const first = await listVideos().expect(200);
    const firstBody = first.body as PageBody;
    const second = await listVideos({
      cursor: firstBody.next_cursor!,
    }).expect(200);
    const secondBody = second.body as PageBody;

    expect(titles(second)).toEqual(['T2', 'T1']);
    expect(secondBody.next_cursor).toBeNull();
    const firstIds = new Set(firstBody.items.map((item) => item.public_id));
    expect(secondBody.items.some((item) => firstIds.has(item.public_id))).toBe(
      false,
    );

    const invalid = await listVideos({ cursor: 'nao-e-um-cursor' }).expect(400);
    expect((invalid.body as ErrorBody).error).toBe('VALIDATION_ERROR');
  });

  it('never-lists-drafts-unlisted-or-not-ready', async () => {
    const token = await authenticate('dono@example.com');
    const channel = await channelOf('dono@example.com');
    await seedVideo(channel, { title: 'P' });
    await seedVideo(channel, { title: 'rascunho', status: 'draft' });
    await seedVideo(channel, { title: 'unlisted', visibility: 'unlisted' });
    await seedVideo(channel, {
      title: 'processando',
      processing_status: 'processing',
    });
    await seedVideo(channel, { title: 'falhou', processing_status: 'failed' });

    expect(titles(await listVideos().expect(200))).toEqual(['P']);
    expect(titles(await listVideos({}, token).expect(200))).toEqual(['P']);
    await listVideos({}, 'token-invalido').expect(401);
  });

  // 2. Filtro por categoria

  it('category-filters-by-slug', async () => {
    const channel = await createChannel('Canal', 'canal_um');
    await seedVideo(channel, { title: 'm1', category: 'music' });
    await seedVideo(channel, { title: 'g1', category: 'gaming' });
    await seedVideo(channel, { title: 'm2', category: 'music' });
    await seedVideo(channel, { title: 'g2', category: 'gaming' });
    await seedVideo(channel, { title: 'm3', category: 'music' });
    await seedVideo(channel, { title: 'sem-categoria' });

    expect(titles(await listVideos({ category: 'music' }).expect(200))).toEqual(
      ['m3', 'm2', 'm1'],
    );

    const unknown = await listVideos({ category: 'inexistente' }).expect(404);
    expect((unknown.body as ErrorBody).error).toBe('CATEGORY_NOT_FOUND');

    const malformed = await listVideos({ category: 'Music !' }).expect(404);
    expect((malformed.body as ErrorBody).error).toBe('CATEGORY_NOT_FOUND');
  });

  // 3. Busca por título e canal

  it('q-matches-title-and-channel-without-accents', async () => {
    const rock = await createChannel('Rock Club', 'rock_club');
    const bia = await createChannel('Músicas do Bia', 'bia_som');
    const edu = await createChannel('Edu', 'edu_canal');
    await seedVideo(rock, { title: 'Música ao vivo', category: 'music' });
    await seedVideo(bia, { title: 'Show 1' });
    await seedVideo(bia, { title: 'Show 2' });
    await seedVideo(edu, { title: 'Aula de cálculo' });

    const expected = ['Show 2', 'Show 1', 'Música ao vivo'];
    expect(titles(await listVideos({ q: 'musica' }).expect(200))).toEqual(
      expected,
    );
    expect(titles(await listVideos({ q: 'MÚSICA' }).expect(200))).toEqual(
      expected,
    );
    expect(titles(await listVideos({ q: 'bia_som' }).expect(200))).toEqual([
      'Show 2',
      'Show 1',
    ]);
    expect(
      titles(await listVideos({ q: 'musica', category: 'music' }).expect(200)),
    ).toEqual(['Música ao vivo']);
  });

  it('q-length-is-validated', async () => {
    const channel = await createChannel('Canal', 'canal_um');
    await seedVideo(channel, { title: 'abacaxi' });

    for (const q of ['a', '   ', 'x'.repeat(101)]) {
      const res = await listVideos({ q }).expect(400);
      expect((res.body as ErrorBody).error).toBe('VALIDATION_ERROR');
    }
    expect(titles(await listVideos({ q: ' ab ' }).expect(200))).toEqual([
      'abacaxi',
    ]);
  });

  it('q-wildcards-are-literal', async () => {
    const channel = await createChannel('Canal', 'canal_um');
    await seedVideo(channel, { title: 'Desconto de 100% hoje' });
    await seedVideo(channel, { title: '100 vídeos' });
    await seedVideo(channel, { title: 'Tutorial_avancado' });
    await seedVideo(channel, { title: 'Tutorialxavancado' });

    expect(titles(await listVideos({ q: '100%' }).expect(200))).toEqual([
      'Desconto de 100% hoje',
    ]);
    expect(titles(await listVideos({ q: 'l_a' }).expect(200))).toEqual([
      'Tutorial_avancado',
    ]);
  });

  // 4. Limite de requisições

  it('listing-routes-allow-60-per-minute', async () => {
    const token = await authenticate('fa@example.com');
    const channel = await createChannel('Canal', 'canal_um');

    async function burst(
      path: string,
      ip: string,
      bearer?: string,
    ): Promise<number[]> {
      const statuses: number[] = [];
      for (let n = 0; n < 61; n++) {
        const req = request(app.getHttpServer())
          .get(path)
          .set('X-Forwarded-For', ip);
        const res = await (bearer
          ? req.set('Authorization', `Bearer ${bearer}`)
          : req);
        statuses.push(res.status);
      }
      return statuses;
    }

    for (const [path, ip, bearer] of [
      ['/videos', '203.0.113.7', undefined],
      [`/channels/${channel.nickname}/videos`, '203.0.113.8', undefined],
      ['/me/subscriptions/videos', '203.0.113.9', token],
    ] as const) {
      const statuses = await burst(path, ip, bearer);
      expect(statuses.slice(0, 60).every((status) => status === 200)).toBe(
        true,
      );
      expect(statuses[60]).toBe(429);
    }
  });
});
