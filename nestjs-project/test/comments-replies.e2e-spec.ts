// Generated from specs/comments-replies.plan.md (SI-06.6 — phase-06-social-interactions).
// One describe per spec; one test per scenario; group headings kept as comments.
import request from 'supertest';
import { Comment } from '../src/comments/entities/comment.entity';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { seedUserWithChannel, seedVideo } from '../src/test/social-fixtures';
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
  reply_count: number;
};
type CommentsPageBody = { items: CommentBody[]; next_cursor: string | null };

describe('comments-replies', () => {
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
  // Cada IP tem o próprio orçamento do throttler global (10/min por rota): o seed de 22 respostas
  // usa um IP por requisição para não esbarrar no limite.
  let ipCounter = 0;
  const nextIp = () => `203.0.113.${(ipCounter++ % 200) + 1}`;

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

  async function createRoot(auth: string, publicId: string, text: string) {
    const res = await request(server())
      .post(`/videos/${publicId}/comments`)
      .set('X-Forwarded-For', nextIp())
      .set('Authorization', auth)
      .send({ text })
      .expect(201);
    return res.body as CommentBody;
  }

  function reply(commentId: string, text: string, auth?: string) {
    const req = request(server())
      .post(`/comments/${commentId}/replies`)
      .set('X-Forwarded-For', nextIp());
    return (auth ? req.set('Authorization', auth) : req).send({ text });
  }

  function listReplies(commentId: string, cursor?: string) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return request(server())
      .get(`/comments/${commentId}/replies${query}`)
      .set('X-Forwarded-For', nextIp());
  }

  async function replyCount(rootId: string) {
    const root = await ctx.dataSource
      .getRepository(Comment)
      .findOneByOrFail({ id: rootId });
    return root.reply_count;
  }

  async function commentCount(publicId: string) {
    const video = await ctx.dataSource
      .getRepository(Video)
      .findOneByOrFail({ public_id: publicId });
    return video.comment_count;
  }

  // ### 1. Responder

  test('1.1 reply-to-root-increments-counters', async () => {
    const video = await publishedVideo();
    const ana = await authenticate('ana');
    const root = await createRoot(ana, video.public_id, 'raiz');
    const bia = await authenticate('bia');
    expect(root.reply_count).toBe(0);
    expect(await commentCount(video.public_id)).toBe(1);

    const res = await reply(root.id, 'Concordo', bia).expect(201);
    expect(res.body as CommentBody).toMatchObject({
      parent_id: root.id,
      reply_count: 0,
    });
    expect(await replyCount(root.id)).toBe(1);
    expect(await commentCount(video.public_id)).toBe(2);
  });

  test('1.2 reply-to-reply-attaches-to-root', async () => {
    const video = await publishedVideo();
    const ana = await authenticate('ana');
    const bia = await authenticate('bia');
    const root = await createRoot(ana, video.public_id, 'raiz');
    const biaReply = (await reply(root.id, 'Concordo', bia).expect(201))
      .body as CommentBody;
    expect(biaReply.parent_id).toBe(root.id);

    const res = await reply(biaReply.id, '@bia obrigado', ana).expect(201);
    expect((res.body as CommentBody).parent_id).toBe(root.id);
    expect(await replyCount(root.id)).toBe(2);
  });

  test('1.3 reply-without-token-returns-401', async () => {
    const video = await publishedVideo();
    const ana = await authenticate('ana');
    const root = await createRoot(ana, video.public_id, 'raiz');

    await reply(root.id, 'anônimo').expect(401);
    expect(await replyCount(root.id)).toBe(0);
  });

  // ### 2. Listar

  test('2.1 replies-listed-oldest-first-with-cursor', async () => {
    const video = await publishedVideo();
    const ana = await authenticate('ana');
    const bia = await authenticate('bia');
    const root = await createRoot(ana, video.public_id, 'raiz');
    const created: string[] = [];
    for (let index = 0; index < 22; index++) {
      const res = await reply(root.id, `resposta ${index}`, bia).expect(201);
      created.push((res.body as CommentBody).id);
    }

    const first = (await listReplies(root.id).expect(200))
      .body as CommentsPageBody;
    expect(first.items.map((item) => item.id)).toEqual(created.slice(0, 20));
    expect(first.next_cursor).not.toBeNull();

    const second = (await listReplies(root.id, first.next_cursor!).expect(200))
      .body as CommentsPageBody;
    expect(second.items.map((item) => item.id)).toEqual(created.slice(20));
    expect(second.next_cursor).toBeNull();
  });

  test('2.2 replies-of-a-reply-returns-404', async () => {
    const video = await publishedVideo();
    const ana = await authenticate('ana');
    const root = await createRoot(ana, video.public_id, 'raiz');
    const answer = (await reply(root.id, 'Concordo', ana).expect(201))
      .body as CommentBody;

    const res = await listReplies(answer.id).expect(404);
    expect((res.body as ErrorBody).error).toBe('COMMENT_NOT_FOUND');
  });
});
