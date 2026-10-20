// Generated from specs/videos-reaction.plan.md (SI-06.2 — phase-06-social-interactions).
// One describe per spec; one test per scenario; group headings kept as comments.
import request from 'supertest';
import { Video } from '../src/videos/entities/video.entity';
import { VideoReaction } from '../src/reactions/entities/video-reaction.entity';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { seedUserWithChannel, seedVideo } from '../src/test/social-fixtures';
import {
  bearerFor,
  bootstrapSocialApp,
  type ErrorBody,
  type SocialApp,
} from './support/social-app';

type ReactionState = {
  viewer_reaction: 'like' | 'dislike' | null;
  like_count: number;
  dislike_count: number;
};

describe('videos-reaction', () => {
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

  async function publishedVideoAndViewer() {
    const { channel } = await seedUserWithChannel(ctx.dataSource, 'canal');
    const { user: ana } = await seedUserWithChannel(ctx.dataSource, 'ana');
    const video = await seedVideo(ctx.dataSource, channel);
    return { video, auth: bearerFor(ctx.jwt, ana) };
  }

  function react(publicId: string, auth: string, value: string) {
    return request(server())
      .put(`/videos/${publicId}/reaction`)
      .set('Authorization', auth)
      .set('X-Forwarded-For', '203.0.113.20')
      .send({ value });
  }

  async function counts(videoId: string) {
    const video = await ctx.dataSource
      .getRepository(Video)
      .findOneByOrFail({ id: videoId });
    return { like: video.like_count, dislike: video.dislike_count };
  }

  // ### 1. Transições de reação

  test('1.1 like-then-repeat-is-idempotent', async () => {
    const { video, auth } = await publishedVideoAndViewer();
    expect(await counts(video.id)).toEqual({ like: 0, dislike: 0 });

    const first = await react(video.public_id, auth, 'like').expect(200);
    expect(first.body as ReactionState).toEqual({
      viewer_reaction: 'like',
      like_count: 1,
      dislike_count: 0,
    });

    const again = await react(video.public_id, auth, 'like').expect(200);
    expect(again.body).toEqual(first.body);
    expect(await counts(video.id)).toEqual({ like: 1, dislike: 0 });
    expect(await ctx.dataSource.getRepository(VideoReaction).count()).toBe(1);
  });

  test('1.2 switch-to-dislike-and-remove', async () => {
    const { video, auth } = await publishedVideoAndViewer();
    await react(video.public_id, auth, 'like').expect(200);

    const switched = await react(video.public_id, auth, 'dislike').expect(200);
    expect(switched.body as ReactionState).toEqual({
      viewer_reaction: 'dislike',
      like_count: 0,
      dislike_count: 1,
    });

    const removed = await request(server())
      .delete(`/videos/${video.public_id}/reaction`)
      .set('Authorization', auth)
      .expect(200);
    const empty: ReactionState = {
      viewer_reaction: null,
      like_count: 0,
      dislike_count: 0,
    };
    expect(removed.body).toEqual(empty);

    const again = await request(server())
      .delete(`/videos/${video.public_id}/reaction`)
      .set('Authorization', auth)
      .expect(200);
    expect(again.body).toEqual(empty);
    expect(await ctx.dataSource.getRepository(VideoReaction).count()).toBe(0);
  });

  // ### 2. Validação, autenticação e visibilidade

  test('2.1 invalid-value-and-missing-token', async () => {
    const { video, auth } = await publishedVideoAndViewer();

    const invalid = await react(video.public_id, auth, 'love').expect(400);
    expect((invalid.body as ErrorBody).error).toBe('VALIDATION_ERROR');

    await request(server())
      .put(`/videos/${video.public_id}/reaction`)
      .send({ value: 'like' })
      .expect(401);
    expect(await ctx.dataSource.getRepository(VideoReaction).count()).toBe(0);
  });

  test('2.2 owner-reacting-to-own-draft-gets-404', async () => {
    const { user, channel } = await seedUserWithChannel(ctx.dataSource, 'dono');
    const draft = await seedVideo(ctx.dataSource, channel, {
      status: 'draft',
      published_at: null,
    });

    const res = await react(
      draft.public_id,
      bearerFor(ctx.jwt, user),
      'like',
    ).expect(404);
    expect((res.body as ErrorBody).error).toBe('VIDEO_NOT_FOUND');
    expect(await counts(draft.id)).toEqual({ like: 0, dislike: 0 });
  });

  test('2.3 reaction-route-throttles-at-60-per-minute', async () => {
    const { video, auth } = await publishedVideoAndViewer();

    for (let i = 0; i < 60; i++) {
      await react(
        video.public_id,
        auth,
        i % 2 === 0 ? 'like' : 'dislike',
      ).expect(200);
    }

    await react(video.public_id, auth, 'like').expect(429);
  });
});
