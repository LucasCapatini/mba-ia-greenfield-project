// Generated from specs/comments.plan.md (SI-06.5 — phase-06-social-interactions).
// One describe per spec; one test per scenario; group headings kept as comments.
import request from 'supertest';
import { Comment } from '../src/comments/entities/comment.entity';
import { CommentReaction } from '../src/reactions/entities/comment-reaction.entity';
import { cleanAllTables } from '../src/test/create-test-data-source';
import {
  seedComment,
  seedUserWithChannel,
  seedVideo,
} from '../src/test/social-fixtures';
import { Video } from '../src/videos/entities/video.entity';
import {
  bearerFor,
  bootstrapSocialApp,
  type ErrorBody,
  type SocialApp,
} from './support/social-app';

type CommentBody = {
  id: string;
  parent_id: string | null;
  text: string;
  author: { nickname: string; name: string };
  edited_at: string | null;
  like_count: number;
  reply_count: number;
  viewer_reaction: 'like' | 'dislike' | null;
  viewer_is_author: boolean;
};
type CommentsPageBody = { items: CommentBody[]; next_cursor: string | null };

describe('comments', () => {
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
  const FORWARDED = '203.0.113.50';

  async function authenticate(nickname: string) {
    const seeded = await seedUserWithChannel(ctx.dataSource, 'x', {
      nickname,
    });
    return { ...seeded, auth: bearerFor(ctx.jwt, seeded.user) };
  }

  async function publishedVideo() {
    const { channel } = await authenticate('criador');
    return seedVideo(ctx.dataSource, channel);
  }

  function send(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    auth?: string,
  ) {
    const req = request(server())
      [method](path)
      .set('X-Forwarded-For', FORWARDED);
    return auth ? req.set('Authorization', auth) : req;
  }

  async function commentCount(publicId: string) {
    const video = await ctx.dataSource
      .getRepository(Video)
      .findOneByOrFail({ public_id: publicId });
    return video.comment_count;
  }

  // ### 1. Criar e listar

  test('1.1 create-trims-text-and-increments-count', async () => {
    const video = await publishedVideo();
    const ana = await authenticate('ana');
    expect(await commentCount(video.public_id)).toBe(0);

    const res = await send(
      'post',
      `/videos/${video.public_id}/comments`,
      ana.auth,
    )
      .send({ text: '  Ótimo vídeo  ' })
      .expect(201);

    expect(res.body as CommentBody).toMatchObject({
      text: 'Ótimo vídeo',
      parent_id: null,
      reply_count: 0,
      edited_at: null,
      viewer_is_author: true,
      author: { nickname: 'ana' },
    });
    expect(await commentCount(video.public_id)).toBe(1);
  });

  test('1.2 invalid-text-and-missing-token', async () => {
    const video = await publishedVideo();
    const ana = await authenticate('ana');
    const path = `/videos/${video.public_id}/comments`;

    const blank = await send('post', path, ana.auth)
      .send({ text: '   ' })
      .expect(400);
    expect((blank.body as ErrorBody).error).toBe('VALIDATION_ERROR');

    const tooLong = await send('post', path, ana.auth)
      .send({ text: 'a'.repeat(2001) })
      .expect(400);
    expect((tooLong.body as ErrorBody).error).toBe('VALIDATION_ERROR');

    await send('post', path, ana.auth)
      .send({ text: 'a'.repeat(2000) })
      .expect(201);

    await send('post', path).send({ text: 'oi' }).expect(401);
  });

  test('1.3 list-roots-by-top-with-cursor', async () => {
    const video = await publishedVideo();
    const ana = await authenticate('ana');
    const roots: Comment[] = [];
    for (let index = 0; index < 25; index++) {
      roots.push(
        await seedComment(ctx.dataSource, video, ana.user, {
          like_count: index * 3,
          text: `raiz ${index}`,
        }),
      );
    }
    for (const n of [1, 2]) {
      await seedComment(ctx.dataSource, video, ana.user, {
        parent_id: roots[0].id,
        text: `resposta ${n}`,
      });
    }
    const path = `/videos/${video.public_id}/comments`;

    const first = (await send('get', `${path}?sort=top`).expect(200))
      .body as CommentsPageBody;
    expect(first.items).toHaveLength(20);
    const likes = first.items.map((item) => item.like_count);
    expect(likes).toEqual([...likes].sort((a, b) => b - a));
    expect(first.next_cursor).not.toBeNull();
    for (const item of first.items) {
      expect(item).toMatchObject({
        parent_id: null,
        viewer_reaction: null,
        viewer_is_author: false,
      });
    }

    const second = (
      await send(
        'get',
        `${path}?sort=top&cursor=${encodeURIComponent(first.next_cursor!)}`,
      ).expect(200)
    ).body as CommentsPageBody;
    expect(second.items).toHaveLength(5);
    expect(second.next_cursor).toBeNull();
    const firstIds = new Set(first.items.map((item) => item.id));
    expect(second.items.some((item) => firstIds.has(item.id))).toBe(false);

    const invalid = await send('get', `${path}?sort=newest`).expect(400);
    expect((invalid.body as ErrorBody).error).toBe('VALIDATION_ERROR');
  });

  test('1.4 draft-comments-are-hidden-even-from-owner', async () => {
    const dono = await authenticate('dono');
    const draft = await seedVideo(ctx.dataSource, dono.channel, {
      status: 'draft',
      published_at: null,
    });
    const path = `/videos/${draft.public_id}/comments`;

    const list = await send('get', path, dono.auth).expect(404);
    expect((list.body as ErrorBody).error).toBe('VIDEO_NOT_FOUND');

    const create = await send('post', path, dono.auth)
      .send({ text: 'oi' })
      .expect(404);
    expect((create.body as ErrorBody).error).toBe('VIDEO_NOT_FOUND');
  });

  // ### 2. Editar e excluir

  test('2.1 only-author-can-edit', async () => {
    const video = await publishedVideo();
    const ana = await authenticate('ana');
    const bia = await authenticate('bia');
    const created = (
      await send('post', `/videos/${video.public_id}/comments`, ana.auth)
        .send({ text: 'Texto original' })
        .expect(201)
    ).body as CommentBody;
    expect(created.edited_at).toBeNull();

    const edited = (
      await send('patch', `/comments/${created.id}`, ana.auth)
        .send({ text: 'Texto revisto' })
        .expect(200)
    ).body as CommentBody;
    expect(edited.text).toBe('Texto revisto');
    expect(edited.edited_at).not.toBeNull();

    const forbidden = await send('patch', `/comments/${created.id}`, bia.auth)
      .send({ text: 'invasão' })
      .expect(403);
    expect((forbidden.body as ErrorBody).error).toBe('COMMENT_FORBIDDEN');
    const stored = await ctx.dataSource
      .getRepository(Comment)
      .findOneByOrFail({ id: created.id });
    expect(stored.text).toBe('Texto revisto');
  });

  test('2.2 deleting-root-cascades-replies-and-counts', async () => {
    const video = await publishedVideo();
    const ana = await authenticate('ana');
    const bia = await authenticate('bia');
    const root = (
      await send('post', `/videos/${video.public_id}/comments`, ana.auth)
        .send({ text: 'raiz' })
        .expect(201)
    ).body as CommentBody;
    const replies: CommentBody[] = [];
    for (const n of [1, 2]) {
      const res = await send('post', `/comments/${root.id}/replies`, bia.auth)
        .send({ text: `resposta ${n}` })
        .expect(201);
      replies.push(res.body as CommentBody);
    }
    await send('put', `/comments/${replies[0].id}/reaction`, bia.auth)
      .send({ value: 'like' })
      .expect(200);
    expect(await commentCount(video.public_id)).toBe(3);

    const forbidden = await send(
      'delete',
      `/comments/${root.id}`,
      bia.auth,
    ).expect(403);
    expect((forbidden.body as ErrorBody).error).toBe('COMMENT_FORBIDDEN');

    await send('delete', `/comments/${root.id}`, ana.auth).expect(204);
    expect(
      await ctx.dataSource
        .getRepository(Comment)
        .countBy({ video_id: video.id }),
    ).toBe(0);
    expect(await ctx.dataSource.getRepository(CommentReaction).count()).toBe(0);
    expect(await commentCount(video.public_id)).toBe(0);
  });

  test('2.3 deleting-unknown-comment-returns-404', async () => {
    const ana = await authenticate('ana');

    const unknown = await send(
      'delete',
      '/comments/00000000-0000-4000-8000-000000000000',
      ana.auth,
    ).expect(404);
    expect((unknown.body as ErrorBody).error).toBe('COMMENT_NOT_FOUND');

    const malformed = await send(
      'delete',
      '/comments/nao-e-uuid',
      ana.auth,
    ).expect(404);
    expect((malformed.body as ErrorBody).error).toBe('COMMENT_NOT_FOUND');
  });
});
