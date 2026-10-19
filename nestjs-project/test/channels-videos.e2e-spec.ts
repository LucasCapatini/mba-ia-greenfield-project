// Generated from specs/channels-videos.plan.md (SI-04.8 — phase-04-video-channel-management).
// One describe per spec; one test per scenario; group headings kept as comments.
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ChannelsService } from '../src/channels/channels.service';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { MailService } from '../src/mail/mail.service';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { Video } from '../src/videos/entities/video.entity';
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

type OwnerPage = {
  items: Array<Record<string, unknown> & { public_id: string; title: string }>;
  next_cursor: string | null;
  total: number;
};

type ChannelPage = {
  items: Array<
    Record<string, unknown> & {
      public_id: string;
      title: string;
      view_count: number;
      published_at: string;
    }
  >;
  next_cursor: string | null;
};

type SeedSpec = {
  title?: string;
  status?: VideoStatus;
  visibility?: VideoVisibility;
  processing_status?: VideoProcessingStatus;
  view_count?: number;
  minute: number;
};

function errorBody(res: request.Response): ErrorBody {
  return res.body as ErrorBody;
}

describe('channels-videos', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let channelsService: ChannelsService;
  let mailService: MailService;
  let throttlerStorage: ThrottlerStorageService;
  let counter = 0;

  beforeAll(async () => {
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
    channelsService = moduleFixture.get(ChannelsService);
    mailService = moduleFixture.get(MailService);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    throttlerStorage.storage.clear();
  });

  /** Registra, confirma e loga `email`; devolve o token e o canal criado no cadastro. */
  async function authenticate(
    email: string,
  ): Promise<{ token: string; channelId: string }> {
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
    const accessToken = (login.body as { access_token: string }).access_token;
    const nickname = email.split('@')[0];
    const channel = await channelsService.findByNickname(nickname);
    return { token: accessToken, channelId: channel!.id };
  }

  /** Insere vídeos direto no repositório com datas espaçadas de 1 minuto (ordem determinística). */
  async function seedVideos(
    channelId: string,
    specs: SeedSpec[],
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const spec of specs) {
      const publicId = `e2el${String(++counter).padStart(7, '0')}`;
      const status = spec.status ?? 'draft';
      await videoRepository.insert({
        public_id: publicId,
        channel_id: channelId,
        title: spec.title ?? `Video ${counter}`,
        original_filename: 'a.mp4',
        content_type: 'video/mp4',
        storage_key: `videos/${publicId}/source`,
        status,
        visibility: spec.visibility ?? 'public',
        processing_status: spec.processing_status ?? 'ready',
        view_count: spec.view_count ?? 0,
        published_at: status === 'published' ? minutes(spec.minute) : null,
      });
      await dataSource.query(
        `UPDATE "videos" SET "created_at" = $1 WHERE "public_id" = $2`,
        [minutes(spec.minute), publicId],
      );
      ids.push(publicId);
    }
    return ids;
  }

  const api = {
    mine: (token?: string, query: Record<string, string | number> = {}) => {
      const req = request(app.getHttpServer())
        .get('/channels/me/videos')
        .query(query);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    },
    channel: (nickname: string, query: Record<string, string | number> = {}) =>
      request(app.getHttpServer())
        .get(`/channels/${nickname}/videos`)
        .query(query),
  };

  // ### 1. Painel do dono

  test('1.1 owner-list-paginates-with-cursor-and-total', async () => {
    const { token, channelId } = await authenticate('lista@example.com');
    const statuses: VideoStatus[] = ['draft', 'published'];
    await seedVideos(
      channelId,
      Array.from({ length: 25 }, (_, i) => ({
        minute: i,
        status: statuses[i % 2],
      })),
    );

    const first = (await api.mine(token).expect(200)).body as OwnerPage;
    expect(first.items).toHaveLength(20);
    expect(first.total).toBe(25);
    expect(first.next_cursor).not.toBeNull();
    const created = first.items.map((item) => item.created_at as string);
    expect(created).toEqual([...created].sort().reverse());
    expect(Object.keys(first.items[0]).sort()).toEqual(
      [
        'public_id',
        'title',
        'status',
        'visibility',
        'processing_status',
        'processing_error',
        'thumbnail_url',
        'duration_seconds',
        'view_count',
        'like_count',
        'comment_count',
        'published_at',
        'created_at',
      ].sort(),
    );

    const second = (
      await api.mine(token, { cursor: first.next_cursor! }).expect(200)
    ).body as OwnerPage;
    expect(second.items).toHaveLength(5);
    expect(second.next_cursor).toBeNull();
    expect(second.total).toBe(25);
    const firstIds = new Set(first.items.map((item) => item.public_id));
    expect(second.items.some((item) => firstIds.has(item.public_id))).toBe(
      false,
    );

    await seedVideos(channelId, [{ minute: 500 }]);
    const again = (
      await api.mine(token, { cursor: first.next_cursor! }).expect(200)
    ).body as OwnerPage;
    expect(again.items.map((item) => item.public_id)).toEqual(
      second.items.map((item) => item.public_id),
    );
  });

  test('1.2 owner-filters-search-and-sort', async () => {
    const { token, channelId } = await authenticate('filtros@example.com');
    await seedVideos(channelId, [
      { title: 'Aula 1', minute: 1, view_count: 5 },
      { title: 'aula 2', minute: 2, view_count: 40 },
      { title: 'Outro', minute: 3, view_count: 10 },
      {
        title: 'Aula publicada',
        status: 'published',
        minute: 4,
        view_count: 1,
      },
      { title: 'Escondido', visibility: 'unlisted', minute: 5, view_count: 0 },
    ]);

    const drafts = (
      await api.mine(token, { status: 'draft', q: 'aula' }).expect(200)
    ).body as OwnerPage;
    expect(drafts.items.map((item) => item.title).sort()).toEqual([
      'Aula 1',
      'aula 2',
    ]);
    expect(drafts.total).toBe(2);

    const unlisted = (
      await api.mine(token, { visibility: 'unlisted' }).expect(200)
    ).body as OwnerPage;
    expect(unlisted.items.map((item) => item.title)).toEqual(['Escondido']);
    expect(unlisted.total).toBe(1);

    const byViews = (await api.mine(token, { sort: 'views' }).expect(200))
      .body as OwnerPage;
    const views = byViews.items.map((item) => item.view_count as number);
    expect(views).toEqual([...views].sort((a, b) => b - a));

    const tooMany = await api.mine(token, { limit: 500 }).expect(400);
    expect(errorBody(tooMany).error).toBe('VALIDATION_ERROR');
    const reversed = await api
      .mine(token, { from: '2026-10-10', to: '2026-10-01' })
      .expect(400);
    expect(errorBody(reversed).error).toBe('VALIDATION_ERROR');

    await api.mine().expect(401);
  });

  // ### 2. Listagem pública do canal

  test('2.1 public-list-shows-only-published-public-videos', async () => {
    const { channelId } = await authenticate('publico@example.com');
    await seedVideos(channelId, [
      { title: 'p1', status: 'published', minute: 1 },
      { title: 'p3', status: 'published', minute: 3 },
      { title: 'p2', status: 'published', minute: 2 },
      { title: 'u', status: 'published', visibility: 'unlisted', minute: 4 },
      { title: 'd1', minute: 5 },
      { title: 'd2', minute: 6 },
    ]);

    const page = (await api.channel('publico').expect(200)).body as ChannelPage;
    expect(page.items).toHaveLength(3);
    expect(page.next_cursor).toBeNull();
    expect(page.items.map((item) => item.title)).toEqual(['p3', 'p2', 'p1']);
    for (const item of page.items) {
      expect(Object.keys(item).sort()).toEqual(
        [
          'public_id',
          'title',
          'thumbnail_url',
          'duration_seconds',
          'view_count',
          'published_at',
          'channel',
        ].sort(),
      );
      expect(item.channel).toEqual({ nickname: 'publico', name: 'publico' });
    }
  });

  test('2.2 public-list-sort-cursor-and-not-found', async () => {
    const { channelId } = await authenticate('publico@example.com');
    await seedVideos(channelId, [
      { title: 'a', status: 'published', view_count: 10, minute: 1 },
      { title: 'b', status: 'published', view_count: 300, minute: 2 },
      { title: 'c', status: 'published', view_count: 50, minute: 3 },
    ]);

    const popular = (
      await api.channel('publico', { sort: 'popular' }).expect(200)
    ).body as ChannelPage;
    expect(popular.items.map((item) => item.view_count)).toEqual([300, 50, 10]);

    const oldest = (
      await api.channel('publico', { sort: 'oldest' }).expect(200)
    ).body as ChannelPage;
    const published = oldest.items.map((item) => item.published_at);
    expect(published).toEqual([...published].sort());

    const badCursor = await api
      .channel('publico', { cursor: 'xxx' })
      .expect(400);
    expect(errorBody(badCursor).error).toBe('VALIDATION_ERROR');

    const missing = await api.channel('nao_existe').expect(404);
    expect(errorBody(missing).error).toBe('CHANNEL_NOT_FOUND');
  });
});
