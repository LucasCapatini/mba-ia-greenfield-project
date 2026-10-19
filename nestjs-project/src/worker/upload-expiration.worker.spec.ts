import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { StorageUnavailableException } from '../storage/storage.exceptions';
import { VideoUpload } from '../videos/entities/video-upload.entity';
import { Video } from '../videos/entities/video.entity';
import { UploadExpirationWorker } from './upload-expiration.worker';

describe('UploadExpirationWorker', () => {
  let worker: UploadExpirationWorker;
  let manager: { update: jest.Mock; delete: jest.Mock };
  let uploadRepository: { findOne: jest.Mock };
  let storage: { abortMultipartUpload: jest.Mock };
  let queue: { work: jest.Mock };

  const session = () => ({
    id: 'session-1',
    video_id: 'video-1',
    upload_id: 'upload-1',
    state: 'active',
    expires_at: new Date('2026-10-19T00:00:00.000Z'),
    video: {
      id: 'video-1',
      public_id: 'abcdefghijk',
      storage_key: 'videos/abcdefghijk/source',
    },
  });
  const job = {
    id: 'job-1',
    name: QUEUE_NAMES.UPLOAD_EXPIRE,
    data: { videoId: 'video-1' },
    retryCount: 0,
  };

  beforeEach(async () => {
    manager = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    uploadRepository = { findOne: jest.fn().mockResolvedValue(session()) };
    storage = { abortMultipartUpload: jest.fn().mockResolvedValue(undefined) };
    queue = { work: jest.fn().mockResolvedValue('worker-id') };

    const module = await Test.createTestingModule({
      providers: [
        UploadExpirationWorker,
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) =>
              cb(manager),
            ),
          },
        },
        {
          provide: getRepositoryToken(VideoUpload),
          useValue: uploadRepository,
        },
        { provide: QueueService, useValue: queue },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    worker = module.get(UploadExpirationWorker);
  });

  it('should register work on upload.expire with batchSize 5 on module init', async () => {
    await worker.onModuleInit();

    expect(queue.work).toHaveBeenCalledWith(
      QUEUE_NAMES.UPLOAD_EXPIRE,
      expect.objectContaining({ batchSize: 5 }),
      expect.any(Function),
    );
  });

  it('should expire an active session: guarded update, abort in storage, then delete the draft', async () => {
    await worker.handle(job);

    expect(uploadRepository.findOne).toHaveBeenCalledWith({
      where: { video_id: 'video-1' },
      relations: ['video'],
    });
    expect(manager.update).toHaveBeenCalledWith(
      VideoUpload,
      { id: 'session-1', state: 'active' },
      { state: 'expired' },
    );
    expect(storage.abortMultipartUpload).toHaveBeenCalledWith(
      'videos/abcdefghijk/source',
      'upload-1',
    );
    expect(manager.delete).toHaveBeenCalledWith(Video, { id: 'video-1' });
    // ordem: a guarda decide antes de tocar no storage
    expect(manager.update.mock.invocationCallOrder[0]).toBeLessThan(
      storage.abortMultipartUpload.mock.invocationCallOrder[0],
    );
    expect(
      storage.abortMultipartUpload.mock.invocationCallOrder[0],
    ).toBeLessThan(manager.delete.mock.invocationCallOrder[0]);
  });

  it.each(['completed', 'aborted', 'expired'])(
    'should be a no-op for a %s session without touching the storage',
    async (state) => {
      uploadRepository.findOne.mockResolvedValueOnce({ ...session(), state });

      await expect(worker.handle(job)).resolves.toBeUndefined();

      expect(manager.update).not.toHaveBeenCalled();
      expect(storage.abortMultipartUpload).not.toHaveBeenCalled();
      expect(manager.delete).not.toHaveBeenCalled();
    },
  );

  it('should be a no-op (no retry) when the video has no session', async () => {
    uploadRepository.findOne.mockResolvedValueOnce(null);

    await expect(worker.handle(job)).resolves.toBeUndefined();

    expect(storage.abortMultipartUpload).not.toHaveBeenCalled();
  });

  it('should not abort the multipart nor delete when the guarded update affects zero rows (complete won the race)', async () => {
    manager.update.mockResolvedValueOnce({ affected: 0 });

    await expect(worker.handle(job)).resolves.toBeUndefined();

    expect(storage.abortMultipartUpload).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('should finish normally when the storage tolerates NoSuchUpload (abort resolves)', async () => {
    // StorageService.abortMultipartUpload já engole NoSuchUpload (runOrNull); o worker só delega.
    storage.abortMultipartUpload.mockResolvedValueOnce(undefined);

    await expect(worker.handle(job)).resolves.toBeUndefined();

    expect(manager.delete).toHaveBeenCalled();
  });

  it('should rethrow a storage outage so the transition rolls back and pg-boss retries', async () => {
    storage.abortMultipartUpload.mockRejectedValueOnce(
      new StorageUnavailableException(
        'abortMultipartUpload',
        new Error('ECONNREFUSED'),
      ),
    );

    await expect(worker.handle(job)).rejects.toBeInstanceOf(
      StorageUnavailableException,
    );

    expect(manager.delete).not.toHaveBeenCalled();
  });
});
