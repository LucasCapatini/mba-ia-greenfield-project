// Generated from specs/channels-subscription.plan.md (SI-06.3 — phase-06-social-interactions).
// One describe per spec; one test per scenario; group headings kept as comments.
import request from 'supertest';
import { Channel } from '../src/channels/entities/channel.entity';
import { Subscription } from '../src/subscriptions/entities/subscription.entity';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { seedUserWithChannel } from '../src/test/social-fixtures';
import {
  bearerFor,
  bootstrapSocialApp,
  type ErrorBody,
  type SocialApp,
} from './support/social-app';

type SubscriptionState = { subscribed: boolean; subscriber_count: number };

describe('channels-subscription', () => {
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

  async function authenticate(nickname: string) {
    const { user } = await seedUserWithChannel(ctx.dataSource, 'x', {
      nickname,
    });
    return bearerFor(ctx.jwt, user);
  }

  function subscription(
    method: 'put' | 'delete',
    nickname: string,
    auth?: string,
  ) {
    const req = request(server())
      [method](`/channels/${nickname}/subscription`)
      .set('X-Forwarded-For', '203.0.113.30');
    return auth ? req.set('Authorization', auth) : req;
  }

  async function subscriberCount(nickname: string) {
    const channel = await ctx.dataSource
      .getRepository(Channel)
      .findOneByOrFail({ nickname });
    return channel.subscriber_count;
  }

  const rows = () => ctx.dataSource.getRepository(Subscription).count();

  // ### 1. Inscrever e desinscrever

  test('1.1 subscribe-is-idempotent', async () => {
    await authenticate('criador');
    const ana = await authenticate('ana');
    expect(await subscriberCount('criador')).toBe(0);

    const first = await subscription('put', 'criador', ana).expect(200);
    expect(first.body as SubscriptionState).toEqual({
      subscribed: true,
      subscriber_count: 1,
    });

    const again = await subscription('put', 'criador', ana).expect(200);
    expect(again.body).toEqual(first.body);
    expect(await rows()).toBe(1);
  });

  test('1.2 unsubscribe-is-idempotent', async () => {
    await authenticate('criador');
    const ana = await authenticate('ana');
    await subscription('put', 'criador', ana).expect(200);
    expect(await subscriberCount('criador')).toBe(1);

    const first = await subscription('delete', 'criador', ana).expect(200);
    expect(first.body as SubscriptionState).toEqual({
      subscribed: false,
      subscriber_count: 0,
    });

    const again = await subscription('delete', 'criador', ana).expect(200);
    expect(again.body).toEqual(first.body);
    expect(await rows()).toBe(0);
  });

  // ### 2. Recusas

  test('2.1 own-channel-returns-422', async () => {
    const criador = await authenticate('criador');

    const res = await subscription('put', 'criador', criador).expect(422);
    expect((res.body as ErrorBody).error).toBe('CANNOT_SUBSCRIBE_OWN_CHANNEL');
    expect(await subscriberCount('criador')).toBe(0);
  });

  test('2.2 unknown-channel-and-missing-token', async () => {
    await authenticate('criador');
    const ana = await authenticate('ana');

    const missing = await subscription('put', 'nao_existe', ana).expect(404);
    expect((missing.body as ErrorBody).error).toBe('CHANNEL_NOT_FOUND');

    await subscription('put', 'criador').expect(401);
  });
});
