import type { S3Client } from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import storageConfig from '../config/storage.config';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type { QueueJob, QueueService } from '../queue/queue.service';
import { S3_INTERNAL_CLIENT } from '../storage/storage.constants';
import { StorageModule } from '../storage/storage.module';
import { StorageService } from '../storage/storage.service';
import { cleanPrefix, deterministicBuffer } from '../test/storage';
import { VideoDeletionWorker } from './video-deletion.worker';

type DeleteJob = QueueJob<typeof QUEUE_NAMES.VIDEO_DELETE>;

// Handler de `video.delete` contra o RustFS real (video-channel-management/TD-09). O consumo
// pela fila é coberto pelo e2e `videos-delete`; aqui o handler é chamado direto.
describe('VideoDeletionWorker (integration — RustFS real)', () => {
  let module: TestingModule;
  let storage: StorageService;
  let worker: VideoDeletionWorker;
  let client: S3Client;
  let bucket: string;
  const publicId = `del${Date.now().toString(36)}`.slice(0, 11);
  const keys = {
    source: `videos/${publicId}/source`,
    auto: `thumbnails/${publicId}/auto.jpg`,
    custom: `thumbnails/${publicId}/custom.jpg`,
  };

  function job(thumbnailKeys: string[], retryCount = 0): DeleteJob {
    return {
      id: 'job-1',
      name: QUEUE_NAMES.VIDEO_DELETE,
      retryCount,
      data: {
        videoId: '6f1c2b0e-4b7a-4c1e-9f62-0d6c8c1f7a10',
        publicId,
        storageKey: keys.source,
        thumbnailKeys,
      },
    };
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [storageConfig] }),
        StorageModule,
      ],
    }).compile();
    storage = module.get(StorageService);
    worker = new VideoDeletionWorker({} as QueueService, storage);
    client = module.get<S3Client>(S3_INTERNAL_CLIENT);
    bucket = process.env.S3_BUCKET!;
  });

  afterAll(async () => {
    await cleanPrefix(client, bucket, `videos/${publicId}/`);
    await cleanPrefix(client, bucket, `thumbnails/${publicId}/`);
    await module.close();
  });

  it('should remove the source and every thumbnail listed in the payload', async () => {
    for (const key of Object.values(keys)) {
      await storage.putObject(
        key,
        deterministicBuffer(128),
        'application/octet-stream',
      );
    }

    await worker.handle(job([keys.auto, keys.custom]));

    for (const key of Object.values(keys)) {
      await expect(storage.headObject(key)).resolves.toBeNull();
    }
  });

  it('should not fail when the objects are already gone (at-least-once delivery)', async () => {
    await expect(
      worker.handle(job([keys.auto, keys.custom])),
    ).resolves.toBeUndefined();
  });

  it('should keep deleting the other keys, then rethrow and log the remaining ones on the last attempt', async () => {
    await storage.putObject(keys.auto, deterministicBuffer(64), 'image/jpeg');
    // The handler deletes the source first; only that call fails, the thumbnails go through
    // the real implementation (jest spies call through by default).
    const deleteSpy = jest
      .spyOn(storage, 'deleteObject')
      .mockRejectedValueOnce(new Error('storage down'));
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(worker.handle(job([keys.auto], 3))).rejects.toThrow(
      'storage down',
    );

    await expect(storage.headObject(keys.auto)).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`video.delete failed`),
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(keys.source));
    deleteSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
