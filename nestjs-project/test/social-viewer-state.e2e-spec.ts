// Generated from specs/social-viewer-state.plan.md (SI-06.4 — phase-06-social-interactions).
// One describe per spec; one test per scenario; group headings kept as comments.
import request from 'supertest';
import { Category } from '../src/categories/entities/category.entity';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { seedUserWithChannel, seedVideo } from '../src/test/social-fixtures';
import {
  bearerFor,
  bootstrapSocialApp,
  type SocialApp,
} from './support/social-app';

type VideoBody = {
  viewer_reaction: 'like' | 'dislike' | null;
  like_count: number;
  channel: {
    nickname: string;
    name: string;
    subscriber_count: number;
    viewer_subscribed: boolean;
  };
};
type ChannelBody = { subscriber_count: number; viewer_subscribed: boolean };
type CardList = { items: { channel: Record<string, unknown> }[] };

describe('social-viewer-state', () => {
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
  const FORWARDED = '203.0.113.40';

  async function authenticate(nickname: string) {
    const seeded = await seedUserWithChannel(ctx.dataSource, 'x', {
      nickname,
      name: `Canal ${nickname}`,
    });
    return { ...seeded, auth: bearerFor(ctx.jwt, seeded.user) };
  }

  function get(path: string, auth?: string) {
    const req = request(server()).get(path).set('X-Forwarded-For', FORWARDED);
    return auth ? req.set('Authorization', auth) : req;
  }

  function put(path: string, auth: string, body?: object) {
    return request(server())
      .put(path)
      .set('X-Forwarded-For', FORWARDED)
      .set('Authorization', auth)
      .send(body ?? {});
  }

  // ### 1. Vídeo

  test('1.1 anonymous-gets-neutral-viewer-state', async () => {
    const { channel } = await authenticate('criador');
    const video = await seedVideo(ctx.dataSource, channel);

    const res = await get(`/videos/${video.public_id}`).expect(200);
    const body = res.body as VideoBody;
    expect(body.viewer_reaction).toBeNull();
    expect(body.channel).toEqual({
      nickname: 'criador',
      name: 'Canal criador',
      subscriber_count: 0,
      viewer_subscribed: false,
    });
  });

  test('1.2 authenticated-sees-own-reaction-and-subscription', async () => {
    const { channel } = await authenticate('criador');
    const video = await seedVideo(ctx.dataSource, channel);
    const ana = await authenticate('ana');

    await put(`/videos/${video.public_id}/reaction`, ana.auth, {
      value: 'like',
    }).expect(200);
    await put('/channels/criador/subscription', ana.auth).expect(200);

    const mine = (await get(`/videos/${video.public_id}`, ana.auth).expect(200))
      .body as VideoBody;
    expect(mine.viewer_reaction).toBe('like');
    expect(mine.like_count).toBe(1);
    expect(mine.channel).toMatchObject({
      subscriber_count: 1,
      viewer_subscribed: true,
    });

    const anonymous = (await get(`/videos/${video.public_id}`).expect(200))
      .body as VideoBody;
    expect(anonymous.viewer_reaction).toBeNull();
    expect(anonymous.channel).toMatchObject({
      subscriber_count: 1,
      viewer_subscribed: false,
    });
  });

  // ### 2. Canal e listagens

  test('2.1 channel-public-read-carries-subscription-state', async () => {
    await authenticate('criador');
    const ana = await authenticate('ana');
    const bia = await authenticate('bia');
    await put('/channels/criador/subscription', ana.auth).expect(200);

    const anonymous = (await get('/channels/criador').expect(200))
      .body as ChannelBody;
    expect(anonymous).toMatchObject({
      subscriber_count: 1,
      viewer_subscribed: false,
    });

    const forAna = (await get('/channels/criador', ana.auth).expect(200))
      .body as ChannelBody;
    expect(forAna.viewer_subscribed).toBe(true);
    const forBia = (await get('/channels/criador', bia.auth).expect(200))
      .body as ChannelBody;
    expect(forBia.viewer_subscribed).toBe(false);
  });

  test('2.2 listings-keep-compact-channel-shape', async () => {
    const { channel } = await authenticate('criador');
    const [category] = await ctx.dataSource
      .getRepository(Category)
      .find({ take: 1 });
    const categoryId = category?.id ?? null;
    const first = await seedVideo(ctx.dataSource, channel, {
      category_id: categoryId,
    });
    await seedVideo(ctx.dataSource, channel, { category_id: categoryId });
    const ana = await authenticate('ana');
    await put('/channels/criador/subscription', ana.auth).expect(200);

    const listing = (
      await get('/channels/criador/videos', ana.auth).expect(200)
    ).body as CardList;
    const related = (
      await get(`/videos/${first.public_id}/related`, ana.auth).expect(200)
    ).body as CardList;

    const items = [...listing.items, ...related.items];
    expect(listing.items).toHaveLength(2);
    expect(related.items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(Object.keys(item.channel).sort()).toEqual(['name', 'nickname']);
    }
  });
});
