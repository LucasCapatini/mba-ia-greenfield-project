// Generated from specs/videos-playback.plan.md (SI-03.10 — phase-03-upload-processing).
// One describe per spec; one test per scenario; group headings kept as comments.
import type { S3Client } from '@aws-sdk/client-s3';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import uploadConfig from '../src/config/upload.config';
import { MailService } from '../src/mail/mail.service';
import { S3_INTERNAL_CLIENT } from '../src/storage/storage.constants';
import { StorageService } from '../src/storage/storage.service';
import { cleanAllTables } from '../src/test/create-test-data-source';
import type {
  PlaybackResponse,
  VideoCreatedResponse,
  VideoResponse,
} from '../src/videos/dto/video-response.dto';
import { abortAllMultipart, cleanPrefix } from '../src/test/storage';
import { videoFixture } from '../src/test/video-fixtures';
import { Video } from '../src/videos/entities/video.entity';

const PASSWORD = 'password123';
const PLAYBACK_URL_TTL = 2;
const UNKNOWN_ID = 'AAAAAAAAAAA';
const TINY_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

type SeedState = 'uploading' | 'processing' | 'ready' | 'failed';
type ErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
};

function errorBody(res: request.Response): ErrorBody {
  return res.body as ErrorBody;
}

function createdBody(res: request.Response): VideoCreatedResponse {
  return res.body as VideoCreatedResponse;
}

function playbackBody(res: request.Response): PlaybackResponse {
  return res.body as PlaybackResponse;
}

function videoBody(res: request.Response): VideoResponse {
  return res.body as VideoResponse;
}

describe('videos-playback', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let storageService: StorageService;
  let s3: S3Client;
  let bucket: string;
  let mailService: MailService;
  let throttlerStorage: ThrottlerStorageService;
  let publicEndpoint: string;
  let fixture: { buffer: Buffer; contentType: string };

  beforeAll(async () => {
    // Dentro do container a assinatura SigV4 precisa apontar para o host alcançável (rustfs:9000).
    process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT;
    publicEndpoint = process.env.S3_PUBLIC_ENDPOINT!;
    fixture = await videoFixture('mp4-h264-aac');

    // PLAYBACK_URL_TTL tem mínimo de 60 s no schema Joi; o cenário de expiração precisa de 2 s,
    // então o namespace `upload` é sobrescrito no provider em vez da variável de ambiente.
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(uploadConfig.KEY)
      .useValue({ ...uploadConfig(), playbackUrlTtlSeconds: PLAYBACK_URL_TTL })
      .compile();

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
    storageService = moduleFixture.get(StorageService);
    s3 = moduleFixture.get<S3Client>(S3_INTERNAL_CLIENT);
    bucket = process.env.S3_BUCKET!;
    mailService = moduleFixture.get(MailService);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
  }, 120000);

  afterAll(async () => {
    await abortAllMultipart(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'thumbnails/');
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    throttlerStorage.storage.clear();
    await abortAllMultipart(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'thumbnails/');
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

  function withAuth(req: request.Test, token?: string): request.Test {
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  const api = {
    video: (id: string, token?: string) =>
      withAuth(request(app.getHttpServer()).get(`/videos/${id}`), token),
    playback: (id: string, token?: string) =>
      withAuth(
        request(app.getHttpServer()).get(`/videos/${id}/playback`),
        token,
      ),
  };

  /** `POST /videos` + estado semeado direto no banco (o fluxo com o worker real é o SI-03.11). */
  async function seedVideo(
    token: string,
    state: SeedState,
    originalFilename = 'a.mp4',
  ): Promise<string> {
    const res = await withAuth(
      request(app.getHttpServer()).post('/videos'),
      token,
    )
      .send({
        original_filename: originalFilename,
        content_type: 'video/mp4',
        size_bytes: fixture.buffer.length,
      })
      .expect(201);
    const publicId = createdBody(res).public_id;
    const video = await videoRepository.findOneByOrFail({
      public_id: publicId,
    });
    if (state === 'processing') {
      await videoRepository.update(video.id, {
        processing_status: 'processing',
      });
    } else if (state === 'ready') {
      const thumbnailKey = `thumbnails/${publicId}/auto.jpg`;
      await storageService.putObject(
        video.storage_key,
        fixture.buffer,
        'video/mp4',
      );
      await storageService.putObject(thumbnailKey, TINY_JPEG, 'image/jpeg');
      await videoRepository.update(video.id, {
        processing_status: 'ready',
        duration_seconds: 2,
        width: 320,
        height: 240,
        container: 'mp4',
        video_codec: 'h264',
        audio_codec: 'aac',
        thumbnail_key: thumbnailKey,
        processed_at: new Date(),
      });
    } else if (state === 'failed') {
      await videoRepository.update(video.id, {
        processing_status: 'failed',
        processing_error: 'UNSUPPORTED_FORMAT',
        processing_error_detail: 'codec hevc',
      });
    }
    return publicId;
  }

  // ### 1. GET /videos/{publicId}

  test('1.1 owner-reads-state-metadata-and-error', async () => {
    const token = await authenticate('owner-read@example.com');

    const uploadingId = await seedVideo(token, 'uploading');
    const uploading = await api.video(uploadingId, token).expect(200);
    expect(uploading.body).toMatchObject({
      public_id: uploadingId,
      status: 'draft',
      processing_status: 'uploading',
      processing_error: null,
      original_filename: 'a.mp4',
      content_type: 'video/mp4',
      duration_seconds: null,
      thumbnail_url: null,
      processed_at: null,
    });
    expect(new Date(videoBody(uploading).created_at).toISOString()).toBe(
      videoBody(uploading).created_at,
    );

    const readyId = await seedVideo(token, 'ready');
    const ready = await api.video(readyId, token).expect(200);
    expect(ready.body).toMatchObject({
      processing_status: 'ready',
      duration_seconds: 2,
      width: 320,
      height: 240,
      container: 'mp4',
      video_codec: 'h264',
      audio_codec: 'aac',
    });
    expect(videoBody(ready).processed_at).not.toBeNull();
    expect(videoBody(ready).thumbnail_url!.startsWith(publicEndpoint)).toBe(
      true,
    );
    const thumb = await fetch(videoBody(ready).thumbnail_url!);
    expect(thumb.status).toBe(200);
    expect(thumb.headers.get('content-type')).toBe('image/jpeg');
    await thumb.arrayBuffer();

    const failedId = await seedVideo(token, 'failed');
    const failed = await api.video(failedId, token).expect(200);
    expect(failed.body).toMatchObject({
      processing_status: 'failed',
      processing_error: 'UNSUPPORTED_FORMAT',
    });
  });

  // ### 2. GET /videos/{publicId}/playback

  test('2.1 ready-video-returns-signed-stream-and-download-urls', async () => {
    const token = await authenticate('owner-play@example.com');
    const publicId = await seedVideo(token, 'ready', 'meu video.mp4');

    const before = Date.now();
    const res = await api.playback(publicId, token).expect(200);

    expect(playbackBody(res).stream_url.startsWith(publicEndpoint)).toBe(true);
    expect(playbackBody(res).download_url.startsWith(publicEndpoint)).toBe(
      true,
    );
    expect(playbackBody(res).thumbnail_url).not.toBeNull();
    const expiresAt = new Date(playbackBody(res).expires_at).getTime();
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(expiresAt).toBeLessThanOrEqual(
      before + (PLAYBACK_URL_TTL + 2) * 1000,
    );

    const ranged = await fetch(playbackBody(res).stream_url, {
      headers: { Range: 'bytes=0-1023' },
    });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get('content-range')).toMatch(/^bytes 0-1023\//);
    expect((await ranged.arrayBuffer()).byteLength).toBe(1024);

    const download = await fetch(playbackBody(res).download_url);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-disposition')).toBe(
      'attachment; filename="meu video.mp4"',
    );
    await download.arrayBuffer();
  });

  test('2.2 not-ready-video-returns-video-not-ready', async () => {
    const token = await authenticate('owner-notready@example.com');

    for (const state of ['processing', 'failed', 'uploading'] as const) {
      const publicId = await seedVideo(token, state);
      const res = await api.playback(publicId, token).expect(409);
      expect(errorBody(res).error).toBe('VIDEO_NOT_READY');
      expect(playbackBody(res).stream_url).toBeUndefined();
    }
  });

  test('2.3 expired-signed-url-is-refused-by-storage', async () => {
    const token = await authenticate('owner-expired@example.com');
    const publicId = await seedVideo(token, 'ready');
    const first = await api.playback(publicId, token).expect(200);

    await new Promise((resolve) =>
      setTimeout(resolve, (PLAYBACK_URL_TTL + 1) * 1000),
    );
    const expired = await fetch(playbackBody(first).stream_url, {
      headers: { Range: 'bytes=0-1023' },
    });
    expect(expired.status).toBe(403);
    await expired.arrayBuffer();

    const second = await api.playback(publicId, token).expect(200);
    expect(playbackBody(second).stream_url).not.toBe(
      playbackBody(first).stream_url,
    );
    expect(new Date(playbackBody(second).expires_at).getTime()).toBeGreaterThan(
      new Date(playbackBody(first).expires_at).getTime(),
    );
  }, 30000);

  // ### 3. Autorização nas rotas de leitura

  // Phase 04 (SI-04.3, TD-07): reads are public with optional auth, so a draft answers 404 to
  // anyone but its owner (it was 401 anonymous / 403 non-owner in Phase 03).
  test('3.1 non-owner-anonymous-and-unknown-ids-are-rejected', async () => {
    const ownerToken = await authenticate('owner-authz@example.com');
    const intruderToken = await authenticate('intruder-play@example.com');
    const publicId = await seedVideo(ownerToken, 'ready');

    // Sequencial: requisições concorrentes contra o servidor do supertest resetam a conexão.
    const anonymousVideo = await api.video(publicId).expect(404);
    expect(errorBody(anonymousVideo).error).toBe('VIDEO_NOT_FOUND');
    const anonymousPlayback = await api.playback(publicId).expect(404);
    expect(errorBody(anonymousPlayback).error).toBe('VIDEO_NOT_FOUND');

    const hiddenVideo = await api.video(publicId, intruderToken).expect(404);
    expect(errorBody(hiddenVideo).error).toBe('VIDEO_NOT_FOUND');
    const hiddenPlayback = await api
      .playback(publicId, intruderToken)
      .expect(404);
    expect(errorBody(hiddenPlayback).error).toBe('VIDEO_NOT_FOUND');
    expect(JSON.stringify(hiddenVideo.body)).not.toContain('X-Amz-Signature');
    expect(JSON.stringify(hiddenPlayback.body)).not.toContain(
      'X-Amz-Signature',
    );
    await api.video(publicId, ownerToken).expect(200);

    const unknownVideo = await api.video(UNKNOWN_ID, ownerToken).expect(404);
    expect(errorBody(unknownVideo).error).toBe('VIDEO_NOT_FOUND');
    const unknownPlayback = await api
      .playback(UNKNOWN_ID, ownerToken)
      .expect(404);
    expect(errorBody(unknownPlayback).error).toBe('VIDEO_NOT_FOUND');
  });

  // ### 4. Leitura pública com auth opcional (Phase 04 — SI-04.3 acceptance)

  async function publish(
    publicId: string,
    visibility: 'public' | 'unlisted' = 'public',
  ): Promise<void> {
    await videoRepository.update(
      { public_id: publicId },
      { status: 'published', visibility, published_at: new Date() },
    );
  }

  test('4.1 published-video-is-readable-without-token', async () => {
    const ownerToken = await authenticate('owner-public@example.com');
    const intruderToken = await authenticate('reader-public@example.com');
    const publicId = await seedVideo(ownerToken, 'ready');
    await publish(publicId);

    const anonymous = await api.video(publicId).expect(200);
    const body = anonymous.body as { public_id: string; status: string };
    expect(body.public_id).toBe(publicId);
    expect(body.status).toBe('published');
    await api.video(publicId, intruderToken).expect(200);
  });

  // Phase 04 (SI-04.5, TD-10): thumbnails are served by a stable public URL, not a presigned one.
  test('4.6 thumbnail-url-is-stable-and-anonymously-readable', async () => {
    const ownerToken = await authenticate('owner-thumb@example.com');
    const publicId = await seedVideo(ownerToken, 'ready');

    const res = await api.video(publicId, ownerToken).expect(200);
    const thumbnailUrl = (res.body as { thumbnail_url: string }).thumbnail_url;
    expect(thumbnailUrl).not.toContain('X-Amz-');
    expect(thumbnailUrl).toMatch(
      new RegExp(`/thumbnails/${publicId}/auto\\.jpg\\?v=\\d+$`),
    );

    const again = await api.video(publicId, ownerToken).expect(200);
    expect((again.body as { thumbnail_url: string }).thumbnail_url).toBe(
      thumbnailUrl,
    );

    const anonymous = await fetch(thumbnailUrl);
    expect(anonymous.status).toBe(200);
    expect(anonymous.headers.get('content-type')).toBe('image/jpeg');
    await anonymous.arrayBuffer();

    const playback = await api.playback(publicId, ownerToken).expect(200);
    expect((playback.body as { thumbnail_url: string }).thumbnail_url).toBe(
      thumbnailUrl,
    );
  });

  test('4.2 published-unlisted-video-is-readable-by-link', async () => {
    const ownerToken = await authenticate('owner-unlisted@example.com');
    const publicId = await seedVideo(ownerToken, 'ready');
    await publish(publicId, 'unlisted');

    const anonymous = await api.video(publicId).expect(200);
    expect((anonymous.body as { visibility: string }).visibility).toBe(
      'unlisted',
    );
  });

  test('4.3 invalid-token-is-rejected-even-for-a-published-video', async () => {
    const ownerToken = await authenticate('owner-badtoken@example.com');
    const publicId = await seedVideo(ownerToken, 'ready');
    await publish(publicId);

    await api.video(publicId, 'invalido').expect(401);
    await api.playback(publicId, 'invalido').expect(401);
  });

  test('4.4 published-ready-playback-works-without-token', async () => {
    const ownerToken = await authenticate('owner-anonplay@example.com');
    const publicId = await seedVideo(ownerToken, 'ready');
    await publish(publicId);

    const res = await api.playback(publicId).expect(200);
    const { stream_url: streamUrl } = res.body as { stream_url: string };
    expect(streamUrl).toContain(`videos/${publicId}/source`);
    expect(streamUrl).toContain('X-Amz-Signature');

    const ranged = await fetch(streamUrl, {
      headers: { Range: 'bytes=0-1023' },
    });
    expect(ranged.status).toBe(206);
    await ranged.arrayBuffer();
  });

  test('4.5 published-but-not-ready-playback-is-409', async () => {
    const ownerToken = await authenticate('owner-notready@example.com');
    const publicId = await seedVideo(ownerToken, 'processing');
    await publish(publicId);

    const res = await api.playback(publicId).expect(409);
    expect(errorBody(res).error).toBe('VIDEO_NOT_READY');
  });
});
