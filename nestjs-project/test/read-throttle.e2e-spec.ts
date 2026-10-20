import request from 'supertest';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { seedUserWithChannel } from '../src/test/social-fixtures';
import {
  bearerFor,
  bootstrapSocialApp,
  type SocialApp,
} from './support/social-app';

// High-frequency reads get 60 req/min per visitor instead of the global 10 (READ_THROTTLE,
// home-search-production/TD-01 — SI-07.18): the watch page reads and the studio processing poll,
// and `GET /me/subscriptions`, read by the app layout on every page with a session. A 404 counts
// like a 200, so an unknown video exercises the budget without fixtures.
const LIMIT = 60;
const UNKNOWN = 'no-such-video';

describe('read throttle (e2e)', () => {
  let ctx: SocialApp;
  let bearer: string;

  beforeAll(async () => {
    ctx = await bootstrapSocialApp();
    await cleanAllTables(ctx.dataSource);
    const { user } = await seedUserWithChannel(ctx.dataSource, 'reader');
    bearer = bearerFor(ctx.jwt, user);
  });

  beforeEach(() => {
    ctx.throttler.storage.clear();
  });

  afterAll(async () => {
    await cleanAllTables(ctx.dataSource);
    await ctx.app.close();
  });

  async function exhaustThenExpect429(path: string, auth?: string) {
    const get = (visitor: string) => {
      const req = request(ctx.app.getHttpServer())
        .get(path)
        .set('X-Forwarded-For', visitor);
      return auth ? req.set('Authorization', auth) : req;
    };
    for (let i = 0; i < LIMIT; i++) {
      expect((await get('203.0.113.50')).status).not.toBe(429);
    }
    expect((await get('203.0.113.50')).status).toBe(429);
    expect((await get('203.0.113.51')).status).not.toBe(429);
  }

  it.each([
    `/videos/${UNKNOWN}`,
    `/videos/${UNKNOWN}/playback`,
    `/videos/${UNKNOWN}/related`,
    `/videos/${UNKNOWN}/comments`,
  ])(
    'GET %s allows 60 reads per minute per visitor, then answers 429',
    async (path) => {
      await exhaustThenExpect429(path);
    },
  );

  it('GET /me/subscriptions allows 60 reads per minute per visitor, then answers 429', async () => {
    await exhaustThenExpect429('/me/subscriptions?limit=7', bearer);
  });
});
