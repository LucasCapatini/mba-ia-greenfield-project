// SI-03.11 — phase-03-upload-processing: fluxo completo com serviços reais e o worker no mesmo
// processo Jest. "10 GB sem 10 GB" (TD-13): UPLOAD_PART_SIZE = 5 MiB e uma fixture de ~10,8 MiB
// provam o multipart com 3 partes; o limite de 10 GiB é verificado como política (413).
import type { S3Client } from '@aws-sdk/client-s3';
import {
  INestApplication,
  INestApplicationContext,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { MailService } from '../src/mail/mail.service';
import { S3_INTERNAL_CLIENT } from '../src/storage/storage.constants';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { abortAllMultipart, cleanPrefix, putPart } from '../src/test/storage';
import {
  videoFixture,
  type VideoFixtureName,
} from '../src/test/video-fixtures';
import { WorkerModule } from '../src/worker/worker.module';

const PASSWORD = 'password123';
const MIB = 1024 * 1024;
const PART_SIZE = 5 * MIB;
const MAX_BYTES = 10 * 1024 * MIB;
/** Maior corpo JSON aceitável numa chamada à API durante o fluxo — qualquer byte de vídeo estoura isto. */
const MAX_API_REQUEST_BYTES = 16 * 1024;
const READY_TIMEOUT_MS = 60_000;

type PresignedPart = { part_number: number; url: string };
type ErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
};

function errorBody(res: request.Response): ErrorBody {
  return res.body as ErrorBody;
}

function chunks(buffer: Buffer): Buffer[] {
  const out: Buffer[] = [];
  for (let offset = 0; offset < buffer.length; offset += PART_SIZE) {
    out.push(
      buffer.subarray(offset, Math.min(offset + PART_SIZE, buffer.length)),
    );
  }
  return out;
}

describe('videos-upload-flow', () => {
  let app: INestApplication<App>;
  let worker: INestApplicationContext;
  let dataSource: DataSource;
  let s3: S3Client;
  let bucket: string;
  let mailService: MailService;
  let throttlerStorage: ThrottlerStorageService;
  let publicEndpoint: string;
  /** Maior Content-Length visto pela API (middleware de teste) — AC "nenhum byte de vídeo pela API". */
  let largestApiRequest = 0;

  beforeAll(async () => {
    process.env.UPLOAD_PART_SIZE = String(PART_SIZE);
    process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT;
    publicEndpoint = process.env.S3_PUBLIC_ENDPOINT!;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      largestApiRequest = Math.max(
        largestApiRequest,
        Number(req.headers['content-length'] ?? 0),
      );
      next();
    });
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
    s3 = moduleFixture.get<S3Client>(S3_INTERNAL_CLIENT);
    bucket = process.env.S3_BUCKET!;
    mailService = moduleFixture.get(MailService);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);

    await cleanAllTables(dataSource);
    await abortAllMultipart(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'thumbnails/');

    // Worker real no mesmo processo (TD-05): consome `video.process` do schema de testes da fila.
    worker = await NestFactory.createApplicationContext(WorkerModule, {
      logger: ['error', 'warn'],
    });
  }, 120000);

  afterAll(async () => {
    await worker?.close();
    await abortAllMultipart(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'videos/');
    await cleanPrefix(s3, bucket, 'thumbnails/');
    await cleanAllTables(dataSource);
    await app.close();
  });

  beforeEach(() => {
    throttlerStorage.storage.clear();
  });

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

  const bearer = (req: request.Test, token: string) =>
    req.set('Authorization', `Bearer ${token}`);
  const api = {
    create: (token: string) =>
      bearer(request(app.getHttpServer()).post('/videos'), token),
    parts: (id: string, token: string) =>
      bearer(
        request(app.getHttpServer()).post(`/videos/${id}/upload/parts`),
        token,
      ),
    state: (id: string, token: string) =>
      bearer(request(app.getHttpServer()).get(`/videos/${id}/upload`), token),
    complete: (id: string, token: string) =>
      bearer(
        request(app.getHttpServer()).post(`/videos/${id}/upload/complete`),
        token,
      ),
    video: (id: string, token: string) =>
      bearer(request(app.getHttpServer()).get(`/videos/${id}`), token),
    playback: (id: string, token: string) =>
      bearer(request(app.getHttpServer()).get(`/videos/${id}/playback`), token),
  };

  /** Pré-cadastro + URLs + PUT direto no storage de todas as partes (ou só `only`); devolve ids e etags. */
  async function uploadFixture(
    token: string,
    name: VideoFixtureName,
    originalFilename: string,
    only?: number[],
  ) {
    const fixture = await videoFixture(name);
    const parts = chunks(fixture.buffer);
    const created = await api
      .create(token)
      .send({
        original_filename: originalFilename,
        content_type: 'video/mp4',
        size_bytes: fixture.buffer.length,
      })
      .expect(201);
    const publicId = created.body.public_id as string;
    expect(created.body.upload.part_count).toBe(parts.length);

    const partNumbers = parts.map((_, i) => i + 1);
    const presigned = await api
      .parts(publicId, token)
      .send({ part_numbers: partNumbers })
      .expect(200);
    const urls = new Map(
      (presigned.body.parts as PresignedPart[]).map((p) => [
        p.part_number,
        p.url,
      ]),
    );
    for (const url of urls.values()) {
      expect(url.startsWith(publicEndpoint)).toBe(true);
    }

    const etags = new Map<number, string>();
    for (const n of only ?? partNumbers) {
      etags.set(n, await putPart(urls.get(n)!, parts[n - 1]));
    }
    return { publicId, fixture, parts, etags, partNumbers };
  }

  async function waitUntilProcessed(publicId: string, token: string) {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    let body = (await api.video(publicId, token).expect(200)).body;
    while (body.processing_status === 'processing' && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      body = (await api.video(publicId, token).expect(200)).body;
    }
    return body;
  }

  test('uploads 3 × 5 MiB parts straight to the storage, completes, is processed by the worker and plays back with Range', async () => {
    const token = await authenticate('flow-owner@example.com');
    const { publicId, fixture, parts, etags, partNumbers } =
      await uploadFixture(token, 'mp4-h264-aac-large', 'meu video.mp4');
    expect(parts).toHaveLength(3);

    // retomada: o storage já tem as 3 partes
    const state = await api.state(publicId, token).expect(200);
    expect(
      state.body.uploaded_parts.map(
        (p: { part_number: number }) => p.part_number,
      ),
    ).toEqual(partNumbers);
    expect(
      state.body.uploaded_parts.map((p: { etag: string }) => p.etag),
    ).toEqual(partNumbers.map((n) => etags.get(n)));

    const completed = await api
      .complete(publicId, token)
      .send({
        parts: partNumbers.map((n) => ({ part_number: n, etag: etags.get(n) })),
      })
      .expect(202);
    expect(completed.body).toMatchObject({
      public_id: publicId,
      processing_status: 'processing',
      size_bytes: fixture.buffer.length,
    });

    // worker in-process consome o job e conclui
    const ready = await waitUntilProcessed(publicId, token);
    expect(ready.processing_status).toBe('ready');
    expect(ready.processing_error).toBeNull();
    expect(ready.duration_seconds).toBeGreaterThan(9.5);
    expect(ready.duration_seconds).toBeLessThan(10.5);
    expect(ready).toMatchObject({
      width: 1280,
      height: 720,
      container: 'mp4',
      video_codec: 'h264',
      audio_codec: 'aac',
      size_bytes: fixture.buffer.length,
    });
    const thumb = await fetch(ready.thumbnail_url);
    expect(thumb.status).toBe(200);
    expect(thumb.headers.get('content-type')).toBe('image/jpeg');
    expect((await thumb.arrayBuffer()).byteLength).toBeGreaterThan(1024);

    // playback por URLs assinadas: Range e download atendidos pelo storage
    const playback = await api.playback(publicId, token).expect(200);
    const ranged = await fetch(playback.body.stream_url, {
      headers: { Range: 'bytes=0-1023' },
    });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get('content-range')).toBe(
      `bytes 0-1023/${fixture.buffer.length}`,
    );
    const head = Buffer.from(await ranged.arrayBuffer());
    expect(head.byteLength).toBe(1024);
    expect(head.equals(fixture.buffer.subarray(0, 1024))).toBe(true);
    const download = await fetch(playback.body.download_url);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-disposition')).toBe(
      'attachment; filename="meu video.mp4"',
    );
    await download.arrayBuffer();

    // nenhuma chamada à API carregou bytes de vídeo: só JSON pequeno
    expect(largestApiRequest).toBeLessThan(MAX_API_REQUEST_BYTES);
  });

  test('rejects a declared size above 10 GiB as policy, before any storage call', async () => {
    const token = await authenticate('flow-big@example.com');

    const res = await api
      .create(token)
      .send({
        original_filename: 'huge.mp4',
        content_type: 'video/mp4',
        size_bytes: MAX_BYTES + 1,
      })
      .expect(413);

    expect(errorBody(res).error).toBe('VIDEO_TOO_LARGE');
  });

  test('refuses to complete when a part was never sent and keeps the session active', async () => {
    const token = await authenticate('flow-missing@example.com');
    const { publicId, etags, partNumbers } = await uploadFixture(
      token,
      'mp4-h264-aac-large',
      'a.mp4',
      [1, 2],
    );

    const res = await api
      .complete(publicId, token)
      .send({
        parts: partNumbers.map((n) => ({
          part_number: n,
          etag: etags.get(n) ?? '"missing"',
        })),
      })
      .expect(422);

    expect(errorBody(res).error).toBe('UPLOAD_INCOMPLETE');
    const video = await api.video(publicId, token).expect(200);
    expect(video.body.processing_status).toBe('uploading');
    const state = await api.state(publicId, token).expect(200);
    expect(state.body.uploaded_parts).toHaveLength(2);
  });

  test('keeps a draft private to its owner', async () => {
    const ownerToken = await authenticate('flow-a@example.com');
    const intruderToken = await authenticate('flow-b@example.com');
    const { publicId } = await uploadFixture(
      ownerToken,
      'mp4-h264-aac',
      'a.mp4',
      [],
    );

    // Phase 04 (TD-07): reads are public with optional auth; a draft is hidden from
    // non-owners with 404 instead of 403, so its existence is not revealed.
    const res = await api.video(publicId, intruderToken).expect(404);

    expect(errorBody(res).error).toBe('VIDEO_NOT_FOUND');
    await api.video(publicId, ownerToken).expect(200);
  });

  test('marks an MKV/HEVC declared as video/mp4 as failed + UNSUPPORTED_FORMAT after the worker inspects the bytes', async () => {
    const token = await authenticate('flow-mkv@example.com');
    const { publicId, etags, partNumbers } = await uploadFixture(
      token,
      'mkv-hevc-aac',
      'fake.mp4',
    );
    await api
      .complete(publicId, token)
      .send({
        parts: partNumbers.map((n) => ({ part_number: n, etag: etags.get(n) })),
      })
      .expect(202);

    const result = await waitUntilProcessed(publicId, token);

    expect(result.processing_status).toBe('failed');
    expect(result.processing_error).toBe('UNSUPPORTED_FORMAT');
    expect(result.thumbnail_url).toBeNull();
    const playback = await api.playback(publicId, token).expect(409);
    expect(errorBody(playback).error).toBe('VIDEO_NOT_READY');
  });
});
