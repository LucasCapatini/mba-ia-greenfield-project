// Generated from specs/comments-reaction.plan.md (SI-06.7 — phase-06-social-interactions).
// One describe per spec; one test per scenario; group headings kept as comments.
import request from 'supertest';
import { CommentReaction } from '../src/reactions/entities/comment-reaction.entity';
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
type CommentBody = {
  id: string;
  like_count: number;
  dislike_count: number;
  viewer_reaction: 'like' | 'dislike' | null;
};
type CommentsPageBody = { items: CommentBody[]; next_cursor: string | null };

describe('comments-reaction', () => {
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
  const FORWARDED = '203.0.113.60';

  async function authenticate(nickname: string) {
    const { user } = await seedUserWithChannel(ctx.dataSource, 'x', {
      nickname,
    });
    return bearerFor(ctx.jwt, user);
  }

  async function publishedVideo() {
    const { channel } = await seedUserWithChannel(ctx.dataSource, 'x', {
      nickname: 'criador',
    });
    return seedVideo(ctx.dataSource, channel);
  }

  function send(
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    auth?: string,
  ) {
    const req = request(server())
      [method](path)
      .set('X-Forwarded-For', FORWARDED);
    return auth ? req.set('Authorization', auth) : req;
  }

  async function createRoot(auth: string, publicId: string, text: string) {
    const res = await send('post', `/videos/${publicId}/comments`, auth)
      .send({ text })
      .expect(201);
    return res.body as CommentBody;
  }

  // ### 1. Reagir a comentários

  test('1.1 like-comment-is-idempotent', async () => {
    const video = await publishedVideo();
    const ana = await authenticate('ana');
    const root = await createRoot(ana, video.public_id, 'raiz');
    const bia = await authenticate('bia');
    expect(root.like_count).toBe(0);

    const first = await send('put', `/comments/${root.id}/reaction`, bia)
      .send({ value: 'like' })
      .expect(200);
    expect(first.body as ReactionState).toEqual({
      viewer_reaction: 'like',
      like_count: 1,
      dislike_count: 0,
    });

    const again = await send('put', `/comments/${root.id}/reaction`, bia)
      .send({ value: 'like' })
      .expect(200);
    expect(again.body).toEqual(first.body);
    expect(await ctx.dataSource.getRepository(CommentReaction).count()).toBe(1);
  });

  test('1.2 remove-comment-reaction', async () => {
    const video = await publishedVideo();
    const ana = await authenticate('ana');
    const root = await createRoot(ana, video.public_id, 'raiz');
    const bia = await authenticate('bia');
    await send('put', `/comments/${root.id}/reaction`, bia)
      .send({ value: 'like' })
      .expect(200);

    const res = await send(
      'delete',
      `/comments/${root.id}/reaction`,
      bia,
    ).expect(200);
    expect(res.body as ReactionState).toEqual({
      viewer_reaction: null,
      like_count: 0,
      dislike_count: 0,
    });
  });

  test('1.3 listing-reflects-viewer-reaction', async () => {
    const video = await publishedVideo();
    const ana = await authenticate('ana');
    const bia = await authenticate('bia');
    const root = await createRoot(ana, video.public_id, 'raiz');
    const reply = (
      await send('post', `/comments/${root.id}/replies`, ana)
        .send({ text: 'resposta' })
        .expect(201)
    ).body as CommentBody;
    await send('put', `/comments/${root.id}/reaction`, bia)
      .send({ value: 'dislike' })
      .expect(200);
    await send('put', `/comments/${reply.id}/reaction`, bia)
      .send({ value: 'like' })
      .expect(200);

    const roots = (
      await send('get', `/videos/${video.public_id}/comments`, bia).expect(200)
    ).body as CommentsPageBody;
    expect(roots.items[0]).toMatchObject({
      id: root.id,
      viewer_reaction: 'dislike',
      dislike_count: 1,
    });
    const replies = (
      await send('get', `/comments/${root.id}/replies`, bia).expect(200)
    ).body as CommentsPageBody;
    expect(replies.items[0]).toMatchObject({
      id: reply.id,
      viewer_reaction: 'like',
      like_count: 1,
    });

    const anonymousRoots = (
      await send('get', `/videos/${video.public_id}/comments`).expect(200)
    ).body as CommentsPageBody;
    const anonymousReplies = (
      await send('get', `/comments/${root.id}/replies`).expect(200)
    ).body as CommentsPageBody;
    for (const item of [...anonymousRoots.items, ...anonymousReplies.items]) {
      expect(item.viewer_reaction).toBeNull();
    }
  });

  // ### 2. Recusas

  test('2.1 unknown-comment-and-missing-token', async () => {
    const video = await publishedVideo();
    const ana = await authenticate('ana');
    const root = await createRoot(ana, video.public_id, 'raiz');

    const unknown = await send(
      'put',
      '/comments/00000000-0000-4000-8000-000000000000/reaction',
      ana,
    )
      .send({ value: 'like' })
      .expect(404);
    expect((unknown.body as ErrorBody).error).toBe('COMMENT_NOT_FOUND');

    await send('put', `/comments/${root.id}/reaction`)
      .send({ value: 'like' })
      .expect(401);
  });
});
