// Generated from specs/videos-thumbnail.plan.md (SI-04.6 — phase-04-video-channel-management).
// One describe per spec; one test per scenario; group headings kept as comments.
import type { S3Client } from '@aws-sdk/client-s3';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import sharp from 'sharp';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { MailService } from '../src/mail/mail.service';
import { S3_INTERNAL_CLIENT } from '../src/storage/storage.constants';
import { StorageService } from '../src/storage/storage.service';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { abortAllMultipart, cleanPrefix } from '../src/test/storage';
import { Video } from '../src/videos/entities/video.entity';

const PASSWORD = 'password123';
const MIB = 1024 * 1024;

type ErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
};

type VideoBody = {
  has_custom_thumbnail: boolean;
  thumbnail_url: string | null;
};

function errorBody(res: request.Response): ErrorBody {
  return res.body as ErrorBody;
}

function videoBody(res: request.Response): VideoBody {
  return res.body as VideoBody;
}

function png(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: '#c03030' },
  })
    .png()
    .toBuffer();
}

function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: '#303030' },
  })
    .jpeg()
    .toBuffer();
}

function bigBuffer(bytes: number): Buffer {
  return Buffer.alloc(bytes, 7);
}

describe('videos-thumbnail', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let storageService: StorageService;
  let s3: S3Client;
  let bucket: string;
  let mailService: MailService;
  let throttlerStorage: ThrottlerStorageService;

  beforeAll(async () => {
    // Inside the container localhost:9000 is the container itself; the public URL must point to
    // the reachable internal host so that `fetch(thumbnail_url)` works.
    process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT;

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
    storageService = moduleFixture.get(StorageService);
    s3 = moduleFixture.get<S3Client>(S3_INTERNAL_CLIENT);
    bucket = process.env.S3_BUCKET!;
    mailService = moduleFixture.get(MailService);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
  }, 60000);

  afterAll(async () => {
    await abortAllMultipart(s3, bucket, 'videos/');
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

  /** `POST /videos` + thumbnail automática no storage + `ready` no banco (sem worker). */
  async function seedReadyVideo(token: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        original_filename: 'aula.mp4',
        content_type: 'video/mp4',
        size_bytes: MIB,
      })
      .expect(201);
    const publicId = (res.body as { public_id: string }).public_id;
    const thumbnailKey = `thumbnails/${publicId}/auto.jpg`;
    await storageService.putObject(
      thumbnailKey,
      await jpeg(640, 360),
      'image/jpeg',
    );
    await videoRepository.update(
      { public_id: publicId },
      { processing_status: 'ready', thumbnail_key: thumbnailKey },
    );
    return publicId;
  }

  const api = {
    get: (id: string, token: string) =>
      request(app.getHttpServer())
        .get(`/videos/${id}`)
        .set('Authorization', `Bearer ${token}`),
    put: (id: string, token?: string) => {
      const req = request(app.getHttpServer()).put(`/videos/${id}/thumbnail`);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    },
    delete: (id: string, token?: string) => {
      const req = request(app.getHttpServer()).delete(
        `/videos/${id}/thumbnail`,
      );
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    },
  };

  async function readObject(key: string): Promise<Buffer> {
    const res = await fetch(storageService.publicUrl(key));
    return Buffer.from(await res.arrayBuffer());
  }

  // ### 1. Enviar thumbnail customizada

  test('1.1 valid-png-becomes-normalized-custom-jpeg', async () => {
    const token = await authenticate('thumb@example.com');
    const publicId = await seedReadyVideo(token);

    const res = await api
      .put(publicId, token)
      .attach('file', await png(1920, 1080), 'capa.png')
      .expect(200);

    const body = videoBody(res);
    expect(body.has_custom_thumbnail).toBe(true);
    expect(body.thumbnail_url).toContain(
      `thumbnails/${publicId}/custom.jpg?v=`,
    );
    expect(body.thumbnail_url).not.toContain('X-Amz-');

    const head = await storageService.headObject(
      `thumbnails/${publicId}/custom.jpg`,
    );
    expect(head?.contentType).toBe('image/jpeg');
    const metadata = await sharp(
      await readObject(`thumbnails/${publicId}/custom.jpg`),
    ).metadata();
    expect([metadata.format, metadata.width, metadata.height]).toEqual([
      'jpeg',
      1280,
      720,
    ]);

    const anonymous = await fetch(body.thumbnail_url!);
    expect(anonymous.status).toBe(200);
    expect(anonymous.headers.get('content-type')).toBe('image/jpeg');
    await anonymous.arrayBuffer();

    await expect(
      storageService.headObject(`thumbnails/${publicId}/auto.jpg`),
    ).resolves.not.toBeNull();
  });

  test('1.2 oversized-and-non-image-files-are-rejected', async () => {
    const token = await authenticate('thumb-reject@example.com');
    const publicId = await seedReadyVideo(token);

    const tooLarge = await api
      .put(publicId, token)
      .attach('file', bigBuffer(6 * MIB), 'grande.png')
      .expect(413);
    expect(errorBody(tooLarge).error).toBe('THUMBNAIL_TOO_LARGE');

    const notImage = await api
      .put(publicId, token)
      .attach('file', Buffer.from('não sou imagem'), 'falso.png')
      .expect(400);
    expect(errorBody(notImage).error).toBe('THUMBNAIL_INVALID');

    const tooSmall = await api
      .put(publicId, token)
      .attach('file', await png(320, 180), 'pequena.png')
      .expect(400);
    expect(errorBody(tooSmall).error).toBe('THUMBNAIL_INVALID');

    const noFile = await api
      .put(publicId, token)
      .set('Content-Type', 'multipart/form-data; boundary=empty')
      .send('--empty--\r\n')
      .expect(400);
    expect(errorBody(noFile).error).toBe('VALIDATION_ERROR');

    const read = await api.get(publicId, token).expect(200);
    expect(videoBody(read).has_custom_thumbnail).toBe(false);
    await expect(
      storageService.headObject(`thumbnails/${publicId}/custom.jpg`),
    ).resolves.toBeNull();
  });

  // ### 2. Remover thumbnail customizada

  test('2.1 delete-reverts-to-automatic-and-is-idempotent', async () => {
    const ownerToken = await authenticate('thumb-owner@example.com');
    const intruderToken = await authenticate('thumb-intruder@example.com');
    const publicId = await seedReadyVideo(ownerToken);

    const uploaded = await api
      .put(publicId, ownerToken)
      .attach('file', await png(1280, 720), 'capa.png')
      .expect(200);
    expect(videoBody(uploaded).has_custom_thumbnail).toBe(true);

    await api.delete(publicId, ownerToken).expect(204);
    const read = await api.get(publicId, ownerToken).expect(200);
    expect(videoBody(read).has_custom_thumbnail).toBe(false);
    expect(videoBody(read).thumbnail_url).toContain(
      `thumbnails/${publicId}/auto.jpg?v=`,
    );
    await expect(
      storageService.headObject(`thumbnails/${publicId}/custom.jpg`),
    ).resolves.toBeNull();

    await api.delete(publicId, ownerToken).expect(204);

    // Sequencial: requisições concorrentes contra o servidor do supertest resetam a conexão.
    const forbiddenPut = await api
      .put(publicId, intruderToken)
      .attach('file', await png(1280, 720), 'capa.png')
      .expect(403);
    expect(errorBody(forbiddenPut).error).toBe('VIDEO_FORBIDDEN');
    const forbiddenDelete = await api
      .delete(publicId, intruderToken)
      .expect(403);
    expect(errorBody(forbiddenDelete).error).toBe('VIDEO_FORBIDDEN');

    await api
      .put(publicId)
      .attach('file', await png(1280, 720), 'capa.png')
      .expect(401);
    await api.delete(publicId).expect(401);
  });
});
