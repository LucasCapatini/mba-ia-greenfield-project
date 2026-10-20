// Generated from specs/me-subscriptions.plan.md (SI-06.8 — phase-06-social-interactions).
// One describe per spec; one test per scenario; group headings kept as comments.
import request from 'supertest';
import type { Channel } from '../src/channels/entities/channel.entity';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { seedUserWithChannel, seedVideo } from '../src/test/social-fixtures';
import {
  bearerFor,
  bootstrapSocialApp,
  type ErrorBody,
  type SocialApp,
} from './support/social-app';

type ChannelsPageBody = {
  items: { nickname: string; name: string }[];
  next_cursor: string | null;
};
type FeedPageBody = {
  items: { title: string; channel: Record<string, unknown> }[];
  next_cursor: string | null;
};

describe('me-subscriptions', () => {
  let ctx: SocialApp;

  beforeAll(async () => {
    ctx = await bootstrapSocialApp();
  }, 60000);

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(ctx.dataSource);
    ctx.throttler.storage.clear();
  });

  const server = () => ctx.app.getHttpServer();
  // Orçamento do throttler global (10/min por rota e IP): um IP por requisição.
  let ipCounter = 0;
  const nextIp = () => `198.51.100.${(ipCounter++ % 200) + 1}`;

  async function authenticate(nickname: string) {
    const seeded = await seedUserWithChannel(ctx.dataSource, 'x', {
      nickname,
      name: nickname[0].toUpperCase() + nickname.slice(1),
    });
    return { ...seeded, auth: bearerFor(ctx.jwt, seeded.user) };
  }

  async function subscribe(auth: string, nickname: string) {
    await request(server())
      .put(`/channels/${nickname}/subscription`)
      .set('X-Forwarded-For', nextIp())
      .set('Authorization', auth)
      .expect(200);
  }

  function get(path: string, auth?: string) {
    const req = request(server()).get(path).set('X-Forwarded-For', nextIp());
    return auth ? req.set('Authorization', auth) : req;
  }

  function publish(channel: Channel, title: string, minutesAgo: number) {
    return seedVideo(ctx.dataSource, channel, {
      title,
      published_at: new Date(Date.now() - minutesAgo * 60_000),
    });
  }

  // ### 1. Canais seguidos

  test('1.1 subscribed-channels-alphabetical-with-cursor', async () => {
    const nicknames = [
      'gil',
      'caio',
      'ivo',
      'ana',
      'eva',
      'bia',
      'hugo',
      'davi',
      'fabi',
    ];
    for (const nickname of nicknames) {
      await authenticate(nickname);
    }
    const fa = await authenticate('fa');
    for (const nickname of nicknames) {
      await subscribe(fa.auth, nickname);
    }

    const first = (await get('/me/subscriptions?limit=7', fa.auth).expect(200))
      .body as ChannelsPageBody;
    expect(first.items.map((item) => item.nickname)).toEqual([
      'ana',
      'bia',
      'caio',
      'davi',
      'eva',
      'fabi',
      'gil',
    ]);
    expect(first.items[0]).toEqual({ nickname: 'ana', name: 'Ana' });
    expect(first.next_cursor).not.toBeNull();

    const second = (
      await get(
        `/me/subscriptions?limit=7&cursor=${encodeURIComponent(first.next_cursor!)}`,
        fa.auth,
      ).expect(200)
    ).body as ChannelsPageBody;
    expect(second.items.map((item) => item.nickname)).toEqual(['hugo', 'ivo']);
    expect(second.next_cursor).toBeNull();
  });

  // ### 2. Feed das inscrições

  test('2.1 feed-lists-public-ready-videos-newest-first', async () => {
    const ana = await authenticate('ana');
    const bia = await authenticate('bia');
    const caio = await authenticate('caio');
    await publish(ana.channel, 'ana-antigo', 40);
    await publish(ana.channel, 'ana-novo', 10);
    await publish(bia.channel, 'bia-antigo', 30);
    await publish(bia.channel, 'bia-novo', 5);
    await publish(caio.channel, 'caio', 1);
    const fa = await authenticate('fa');
    await subscribe(fa.auth, 'ana');
    await subscribe(fa.auth, 'bia');

    const feed = (await get('/me/subscriptions/videos', fa.auth).expect(200))
      .body as FeedPageBody;
    expect(feed.items.map((item) => item.title)).toEqual([
      'bia-novo',
      'ana-novo',
      'bia-antigo',
      'ana-antigo',
    ]);
    for (const item of feed.items) {
      expect(Object.keys(item.channel).sort()).toEqual(['name', 'nickname']);
    }
    expect(feed.next_cursor).toBeNull();
  });

  test('2.2 feed-excludes-unlisted-and-drafts', async () => {
    const ana = await authenticate('ana');
    await seedVideo(ctx.dataSource, ana.channel, { visibility: 'unlisted' });
    await seedVideo(ctx.dataSource, ana.channel, {
      status: 'draft',
      published_at: null,
    });
    await seedVideo(ctx.dataSource, ana.channel, {
      processing_status: 'processing',
    });
    const fa = await authenticate('fa');
    await subscribe(fa.auth, 'ana');

    const feed = await get('/me/subscriptions/videos', fa.auth).expect(200);
    expect(feed.body).toEqual({ items: [], next_cursor: null });
  });

  // ### 3. Recusas

  test('3.1 requires-token-and-valid-limit', async () => {
    const fa = await authenticate('fa');

    await get('/me/subscriptions').expect(401);
    await get('/me/subscriptions/videos').expect(401);

    const invalid = await get('/me/subscriptions?limit=0', fa.auth).expect(400);
    expect((invalid.body as ErrorBody).error).toBe('VALIDATION_ERROR');
  });
});
