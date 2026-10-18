import type { S3Client } from '@aws-sdk/client-s3';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import storageConfig from '../config/storage.config';
import {
  abortAllMultipart,
  cleanPrefix,
  deterministicBuffer,
  listMultipartUploads,
  putPart,
  testKeyPrefix,
} from '../test/storage';
import { S3_INTERNAL_CLIENT } from './storage.constants';
import { StorageModule } from './storage.module';
import { StorageService } from './storage.service';

const FIVE_MIB = 5 * 1024 * 1024;

// Smoke test do storage real do compose (RustFS) — valida o que TD-01/TD-03/TD-09 assumem:
// presigned multipart, Range (206), response-content-disposition e abort.
describe('StorageService (integration — RustFS real)', () => {
  let module: TestingModule;
  let service: StorageService;
  let client: S3Client;
  let bucket: string;
  const prefix = testKeyPrefix('storage-service');

  beforeAll(async () => {
    // A suíte roda DENTRO do container: localhost:9000 é o próprio container, e a assinatura
    // SigV4 fixa o host — o cliente "público" precisa apontar para o host interno alcançável.
    process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT;

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [storageConfig] }),
        StorageModule,
      ],
    }).compile();
    service = module.get(StorageService);
    client = module.get<S3Client>(S3_INTERNAL_CLIENT);
    bucket = process.env.S3_BUCKET!;
  });

  afterAll(async () => {
    await abortAllMultipart(client, bucket, prefix);
    await cleanPrefix(client, bucket, prefix);
    await module.close();
  });

  it('should accept presigned part PUTs, list them, complete the object and report size + content type', async () => {
    const key = `${prefix}multipart/source`;
    const part1 = deterministicBuffer(FIVE_MIB, 1);
    const part2 = deterministicBuffer(FIVE_MIB, 2);

    const uploadId = await service.createMultipartUpload(key, 'video/mp4');
    expect(uploadId).toBeTruthy();

    const url1 = await service.presignUploadPart(key, uploadId, 1, 600);
    const url2 = await service.presignUploadPart(key, uploadId, 2, 600);
    const etag1 = await putPart(url1, part1);
    const etag2 = await putPart(url2, part2);

    const listed = await service.listParts(key, uploadId);
    expect(listed).toEqual([
      { partNumber: 1, etag: etag1, size: FIVE_MIB },
      { partNumber: 2, etag: etag2, size: FIVE_MIB },
    ]);

    await service.completeMultipartUpload(key, uploadId, [
      { partNumber: 1, etag: etag1 },
      { partNumber: 2, etag: etag2 },
    ]);

    await expect(service.headObject(key)).resolves.toEqual({
      contentLength: 2 * FIVE_MIB,
      contentType: 'video/mp4',
    });
    await expect(service.listParts(key, uploadId)).resolves.toBeNull();
  }, 60000);

  it('should serve byte ranges (206) through a presigned GET URL', async () => {
    const key = `${prefix}range/source`;
    const body = deterministicBuffer(64 * 1024, 7);
    await service.putObject(key, body, 'video/mp4');

    const url = await service.presignGetObject(key, 600);
    const response = await fetch(url, { headers: { Range: 'bytes=0-1023' } });

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toMatch(/^bytes 0-1023\//);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.byteLength).toBe(1024);
    expect(bytes.equals(body.subarray(0, 1024))).toBe(true);
  });

  it('should return Content-Disposition: attachment through a presigned GET URL (download)', async () => {
    const key = `${prefix}download/source`;
    await service.putObject(key, deterministicBuffer(1024), 'video/mp4');

    const url = await service.presignGetObject(key, 600, {
      responseContentDisposition: 'attachment; filename="meu video.mp4"',
    });
    // A URL é assinada para GET (o método faz parte da assinatura SigV4) — um HEAD retornaria 403.
    const response = await fetch(url);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="meu video.mp4"',
    );
    await response.arrayBuffer();
  });

  it('should abort a multipart session so that listParts returns null and no upload remains', async () => {
    const key = `${prefix}abort/source`;
    const uploadId = await service.createMultipartUpload(key, 'video/webm');
    const url = await service.presignUploadPart(key, uploadId, 1, 600);
    await putPart(url, deterministicBuffer(FIVE_MIB, 3));

    await service.abortMultipartUpload(key, uploadId);

    await expect(service.listParts(key, uploadId)).resolves.toBeNull();
    await expect(
      listMultipartUploads(client, bucket, `${prefix}abort/`),
    ).resolves.toEqual([]);
    await expect(service.headObject(key)).resolves.toBeNull();
    // idempotente: abortar de novo não lança
    await expect(
      service.abortMultipartUpload(key, uploadId),
    ).resolves.toBeUndefined();
  }, 30000);

  it('should return null from headObject for a missing key and delete objects', async () => {
    const key = `${prefix}delete/source`;
    await service.putObject(key, deterministicBuffer(256), 'image/jpeg');
    await expect(service.headObject(key)).resolves.not.toBeNull();

    await service.deleteObject(key);

    await expect(service.headObject(key)).resolves.toBeNull();
  });
});
