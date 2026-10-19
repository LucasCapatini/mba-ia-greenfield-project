import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import storageConfig from '../config/storage.config';
import { StorageUnavailableException } from './storage.exceptions';
import { StorageModule } from './storage.module';
import { StorageService } from './storage.service';

const INTERNAL_ENDPOINT = 'http://rustfs:9000';
const PUBLIC_ENDPOINT = 'http://public.example:9000';
const BUCKET = 'unit-bucket';

// Stub de classe: intercepta send() de TODAS as instâncias de S3Client (os dois clientes do módulo).
// Criado no escopo do arquivo para a tipagem ser inferida; o describe de presign o restaura.
const s3Mock = mockClient(S3Client);

function notFound(name: string): S3ServiceException {
  return new S3ServiceException({
    name,
    $fault: 'client',
    $metadata: { httpStatusCode: 404 },
  });
}

describe('StorageService', () => {
  let module: TestingModule;
  let service: StorageService;

  beforeAll(async () => {
    process.env.S3_ENDPOINT = INTERNAL_ENDPOINT;
    process.env.S3_PUBLIC_ENDPOINT = PUBLIC_ENDPOINT;
    process.env.S3_BUCKET = BUCKET;
    process.env.S3_ACCESS_KEY = 'unit-access';
    process.env.S3_SECRET_KEY = 'unit-secret';
    process.env.S3_REGION = 'us-east-1';
    process.env.S3_FORCE_PATH_STYLE = 'true';

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [storageConfig],
        }),
        StorageModule,
      ],
    }).compile();
    service = module.get(StorageService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('commands (S3Client mocked)', () => {
    beforeEach(() => {
      s3Mock.reset();
    });

    it('should open a multipart upload with bucket, key and content type and return the UploadId', async () => {
      s3Mock.on(CreateMultipartUploadCommand).resolves({ UploadId: 'u-123' });

      const uploadId = await service.createMultipartUpload(
        'videos/abc/source',
        'video/mp4',
      );

      expect(uploadId).toBe('u-123');
      expect(s3Mock).toHaveReceivedCommandWith(CreateMultipartUploadCommand, {
        Bucket: BUCKET,
        Key: 'videos/abc/source',
        ContentType: 'video/mp4',
      });
    });

    it('should paginate ListParts and merge the pages sorted by part number', async () => {
      s3Mock
        .on(ListPartsCommand)
        .resolvesOnce({
          Parts: [{ PartNumber: 2, ETag: '"b"', Size: 10 }],
          IsTruncated: true,
          NextPartNumberMarker: '2',
        })
        .resolvesOnce({
          Parts: [{ PartNumber: 1, ETag: '"a"', Size: 5 }],
          IsTruncated: false,
        });

      const parts = await service.listParts('videos/abc/source', 'u-123');

      expect(parts).toEqual([
        { partNumber: 1, etag: '"a"', size: 5 },
        { partNumber: 2, etag: '"b"', size: 10 },
      ]);
      expect(s3Mock).toHaveReceivedCommandTimes(ListPartsCommand, 2);
      expect(s3Mock).toHaveReceivedNthCommandWith(2, ListPartsCommand, {
        PartNumberMarker: '2',
      });
    });

    it('should return null from listParts when the multipart session no longer exists', async () => {
      s3Mock.on(ListPartsCommand).rejects(notFound('NoSuchUpload'));

      await expect(
        service.listParts('videos/abc/source', 'gone'),
      ).resolves.toBeNull();
    });

    it('should complete the multipart upload with the parts ordered by part number', async () => {
      s3Mock.on(CompleteMultipartUploadCommand).resolves({});

      await service.completeMultipartUpload('videos/abc/source', 'u-123', [
        { partNumber: 2, etag: '"b"' },
        { partNumber: 1, etag: '"a"' },
      ]);

      expect(s3Mock).toHaveReceivedCommandWith(CompleteMultipartUploadCommand, {
        Bucket: BUCKET,
        Key: 'videos/abc/source',
        UploadId: 'u-123',
        MultipartUpload: {
          Parts: [
            { PartNumber: 1, ETag: '"a"' },
            { PartNumber: 2, ETag: '"b"' },
          ],
        },
      });
    });

    it('should tolerate aborting a session that no longer exists', async () => {
      s3Mock.on(AbortMultipartUploadCommand).rejects(notFound('NoSuchUpload'));

      await expect(
        service.abortMultipartUpload('videos/abc/source', 'gone'),
      ).resolves.toBeUndefined();
    });

    it('should return head metadata, or null when the object is missing', async () => {
      s3Mock
        .on(HeadObjectCommand, { Key: 'videos/abc/source' })
        .resolves({ ContentLength: 42, ContentType: 'video/mp4' })
        .on(HeadObjectCommand, { Key: 'videos/missing/source' })
        .rejects(notFound('NotFound'));

      await expect(service.headObject('videos/abc/source')).resolves.toEqual({
        contentLength: 42,
        contentType: 'video/mp4',
      });
      await expect(
        service.headObject('videos/missing/source'),
      ).resolves.toBeNull();
    });

    it('should upload a buffer with its content type and length (thumbnail path)', async () => {
      s3Mock.on(PutObjectCommand).resolves({});
      const body = Buffer.from('jpeg-bytes');

      await service.putObject('thumbnails/abc/auto.jpg', body, 'image/jpeg');

      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: BUCKET,
        Key: 'thumbnails/abc/auto.jpg',
        ContentType: 'image/jpeg',
        ContentLength: body.byteLength,
      });
    });

    it('should map any other storage failure to STORAGE_UNAVAILABLE (503) instead of a generic error', async () => {
      s3Mock
        .on(CreateMultipartUploadCommand)
        .rejects(new Error('ECONNREFUSED'));

      const promise = service.createMultipartUpload(
        'videos/abc/source',
        'video/mp4',
      );

      await expect(promise).rejects.toBeInstanceOf(StorageUnavailableException);
      await expect(promise).rejects.toMatchObject({
        errorCode: 'STORAGE_UNAVAILABLE',
        httpStatus: 503,
      });
    });

    it('should not swallow a 404 on completeMultipartUpload — the session must exist to complete', async () => {
      s3Mock
        .on(CompleteMultipartUploadCommand)
        .rejects(notFound('NoSuchUpload'));

      await expect(
        service.completeMultipartUpload('videos/abc/source', 'gone', [
          { partNumber: 1, etag: '"a"' },
        ]),
      ).rejects.toBeInstanceOf(StorageUnavailableException);
    });
  });

  // getSignedUrl passa pelo middleware stack via send(): precisa do S3Client REAL (sem rede).
  // Roda por último, depois de restaurar o stub de classe usado pelo describe de comandos.
  describe('presigned URLs (no network)', () => {
    beforeAll(() => {
      s3Mock.restore();
    });

    it('should sign UploadPart URLs with the PUBLIC endpoint and path-style bucket', async () => {
      const url = await service.presignUploadPart(
        'videos/abc/source',
        'upload-1',
        3,
        600,
      );
      const parsed = new URL(url);

      expect(`${parsed.protocol}//${parsed.host}`).toBe(PUBLIC_ENDPOINT);
      expect(parsed.pathname).toBe(`/${BUCKET}/videos/abc/source`);
      expect(parsed.searchParams.get('partNumber')).toBe('3');
      expect(parsed.searchParams.get('uploadId')).toBe('upload-1');
      expect(parsed.searchParams.get('X-Amz-Expires')).toBe('600');
      expect(parsed.searchParams.get('X-Amz-Signature')).toBeTruthy();
    });

    it('should sign GetObject URLs with the PUBLIC endpoint by default and the INTERNAL one when public=false', async () => {
      const publicUrl = await service.presignGetObject('videos/abc/source', 60);
      const internalUrl = await service.presignGetObject(
        'videos/abc/source',
        60,
        {
          public: false,
        },
      );

      expect(publicUrl.startsWith(PUBLIC_ENDPOINT)).toBe(true);
      expect(internalUrl.startsWith(INTERNAL_ENDPOINT)).toBe(true);
    });

    it('should carry response-content-disposition in the signed query (download URL)', async () => {
      const url = await service.presignGetObject('videos/abc/source', 60, {
        responseContentDisposition: 'attachment; filename="meu video.mp4"',
      });
      const parsed = new URL(url);

      expect(parsed.searchParams.get('response-content-disposition')).toBe(
        'attachment; filename="meu video.mp4"',
      );
    });
  });
});
