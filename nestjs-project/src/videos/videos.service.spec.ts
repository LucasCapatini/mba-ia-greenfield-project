import { Test } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import uploadConfig from '../config/upload.config';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { type QueueDatabase, QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import type { CreateVideoDto } from './dto/create-video.dto';
import { VideoUpload } from './entities/video-upload.entity';
import { Video } from './entities/video.entity';
import {
  UploadIncompleteException,
  UploadNotActiveException,
  UploadPartOutOfRangeException,
  VideoNotReadyException,
  VideoTooLargeException,
  VideoUnsupportedMediaTypeException,
} from './videos.exceptions';
import type { VideoUploadState } from './videos.constants';
import { VideosService } from './videos.service';

const MIB = 1024 * 1024;

function publicIdViolation(): QueryFailedError {
  const err = new QueryFailedError(
    'INSERT',
    [],
    new Error(),
  ) as QueryFailedError & {
    code?: string;
    detail?: string;
  };
  err.code = '23505';
  err.detail = 'Key (public_id)=(abc) already exists.';
  return err;
}

describe('VideosService', () => {
  let service: VideosService;
  let manager: {
    query: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let storage: {
    createMultipartUpload: jest.Mock;
    abortMultipartUpload: jest.Mock;
    presignUploadPart: jest.Mock;
    listParts: jest.Mock;
    completeMultipartUpload: jest.Mock;
    presignGetObject: jest.Mock;
  };
  let queue: { send: jest.Mock };
  let channels: { findByUserId: jest.Mock };

  const dto: CreateVideoDto = {
    original_filename: 'a.mp4',
    content_type: 'video/mp4',
    size_bytes: 15 * MIB,
  };

  beforeEach(async () => {
    manager = {
      query: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
      save: jest.fn((entity: Record<string, unknown>) =>
        Promise.resolve({
          id: entity.video_id ? 'session-id' : 'video-id',
          status: 'draft',
          processing_status: 'uploading',
          ...entity,
        }),
      ),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    storage = {
      createMultipartUpload: jest.fn().mockResolvedValue('upload-1'),
      abortMultipartUpload: jest.fn().mockResolvedValue(undefined),
      presignUploadPart: jest.fn(
        (_key: string, uploadId: string, partNumber: number) =>
          Promise.resolve(
            `http://rustfs:9000/bucket/key?partNumber=${partNumber}&uploadId=${uploadId}`,
          ),
      ),
      listParts: jest.fn().mockResolvedValue([]),
      completeMultipartUpload: jest.fn().mockResolvedValue(undefined),
      presignGetObject: jest.fn(
        (
          key: string,
          _ttl: number,
          options: { responseContentDisposition?: string } = {},
        ) =>
          Promise.resolve(
            `http://localhost:9000/bucket/${key}?X-Amz-Signature=sig${options.responseContentDisposition ? '&response-content-disposition=' + encodeURIComponent(options.responseContentDisposition) : ''}`,
          ),
      ),
    };
    queue = { send: jest.fn().mockResolvedValue('job-1') };
    channels = {
      findByUserId: jest.fn().mockResolvedValue({ id: 'channel-1' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        VideosService,
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) =>
              cb(manager),
            ),
          },
        },
        { provide: ChannelsService, useValue: channels },
        { provide: StorageService, useValue: storage },
        { provide: QueueService, useValue: queue },
        {
          provide: uploadConfig.KEY,
          useValue: {
            partSize: 5 * MIB,
            maxBytes: 10 * 1024 * MIB,
            urlTtlSeconds: 3600,
            sessionTtlSeconds: 86400,
            playbackUrlTtlSeconds: 43200,
          },
        },
      ],
    }).compile();
    service = module.get(VideosService);
  });

  it('should reject a MIME type outside the allowlist before touching the storage', async () => {
    await expect(
      service.createUpload('user-1', {
        ...dto,
        content_type: 'video/x-matroska',
      }),
    ).rejects.toBeInstanceOf(VideoUnsupportedMediaTypeException);

    expect(storage.createMultipartUpload).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('should reject a declared size above UPLOAD_MAX_BYTES with 413 before touching the storage', async () => {
    const promise = service.createUpload('user-1', {
      ...dto,
      size_bytes: 10 * 1024 * MIB + 1,
    });

    await expect(promise).rejects.toBeInstanceOf(VideoTooLargeException);
    await expect(promise).rejects.toMatchObject({ httpStatus: 413 });
    expect(storage.createMultipartUpload).not.toHaveBeenCalled();
  });

  it('should create the draft, open the multipart, persist the session and schedule upload.expire', async () => {
    const result = await service.createUpload('user-1', dto);

    expect(result.public_id).toMatch(/^[A-Za-z0-9_-]{11}$/);
    expect(result.status).toBe('draft');
    expect(result.processing_status).toBe('uploading');
    expect(result.upload).toMatchObject({
      upload_id: 'upload-1',
      part_size: 5 * MIB,
      part_count: 3, // ceil(15 MiB / 5 MiB)
    });
    expect(new Date(result.upload.expires_at).getTime()).toBeGreaterThan(
      Date.now() + 86_000_000,
    );

    expect(storage.createMultipartUpload).toHaveBeenCalledWith(
      `videos/${result.public_id}/source`,
      'video/mp4',
    );
    expect(manager.create).toHaveBeenCalledWith(
      Video,
      expect.objectContaining({
        channel_id: 'channel-1',
        storage_key: `videos/${result.public_id}/source`,
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      VideoUpload,
      expect.objectContaining({
        video_id: 'video-id',
        upload_id: 'upload-1',
        part_count: 3,
        expected_bytes: 15 * MIB,
      }),
    );
    expect(queue.send).toHaveBeenCalledWith(
      QUEUE_NAMES.UPLOAD_EXPIRE,
      { videoId: 'video-id' },
      expect.objectContaining({
        singletonKey: 'upload:video-id',
        startAfter: expect.any(Date) as Date,
      }),
    );
    expect(storage.abortMultipartUpload).not.toHaveBeenCalled();
  });

  it('should abort the multipart when persisting the session fails, then rethrow', async () => {
    manager.save
      .mockImplementationOnce((entity: Record<string, unknown>) =>
        Promise.resolve({
          id: 'video-id',
          status: 'draft',
          processing_status: 'uploading',
          ...entity,
        }),
      )
      .mockRejectedValueOnce(new Error('insert failed'));

    await expect(service.createUpload('user-1', dto)).rejects.toThrow(
      'insert failed',
    );

    expect(storage.abortMultipartUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^videos\/[A-Za-z0-9_-]{11}\/source$/),
      'upload-1',
    );
    expect(queue.send).not.toHaveBeenCalled();
  });

  it('should retry with a fresh public_id inside a SAVEPOINT when the unique index collides', async () => {
    manager.save
      .mockRejectedValueOnce(publicIdViolation())
      .mockImplementationOnce((entity: Record<string, unknown>) =>
        Promise.resolve({
          id: 'video-id',
          status: 'draft',
          processing_status: 'uploading',
          ...entity,
        }),
      )
      .mockImplementationOnce((entity: Record<string, unknown>) =>
        Promise.resolve({ id: 'session-id', ...entity }),
      );

    const result = await service.createUpload('user-1', dto);

    const videoCreates = (
      manager.create.mock.calls as [unknown, { public_id: string }][]
    ).filter(([entity]) => entity === Video);
    expect(videoCreates).toHaveLength(2);
    expect(videoCreates[0][1].public_id).not.toBe(videoCreates[1][1].public_id);
    expect(result.public_id).toBe(videoCreates[1][1].public_id);
    expect(manager.query).toHaveBeenCalledWith('SAVEPOINT public_id_0');
    expect(manager.query).toHaveBeenCalledWith(
      'ROLLBACK TO SAVEPOINT public_id_0',
    );
    expect(manager.query).toHaveBeenCalledWith('RELEASE SAVEPOINT public_id_1');
  });

  it('should propagate a non-collision insert error without retrying', async () => {
    manager.save.mockRejectedValueOnce(new Error('connection lost'));

    await expect(service.createUpload('user-1', dto)).rejects.toThrow(
      'connection lost',
    );

    expect(
      manager.create.mock.calls.filter(([entity]) => entity === Video),
    ).toHaveLength(1);
    expect(storage.createMultipartUpload).not.toHaveBeenCalled();
  });
  describe('upload session endpoints', () => {
    const session = {
      id: 'session-1',
      upload_id: 'upload-1',
      part_size: 5 * MIB,
      part_count: 3,
      expected_bytes: 12 * MIB,
      state: 'active',
      expires_at: new Date('2030-01-01T00:00:00.000Z'),
    };
    const video = (): Video =>
      ({
        id: 'video-1',
        public_id: 'abcdefghijk',
        status: 'draft',
        processing_status: 'uploading',
        storage_key: 'videos/abcdefghijk/source',
        upload: { ...session },
      }) as unknown as Video;
    const uploadedParts = [
      { partNumber: 1, etag: '"e1"', size: 5 * MIB },
      { partNumber: 2, etag: '"e2"', size: 5 * MIB },
      { partNumber: 3, etag: '"e3"', size: 2 * MIB },
    ];

    it('should presign one URL per requested part with the configured TTL', async () => {
      const result = await service.presignParts(video(), [3, 1]);

      expect(result.upload_id).toBe('upload-1');
      expect(result.part_size).toBe(5 * MIB);
      expect(new Date(result.expires_at).getTime()).toBeGreaterThan(
        Date.now() + 3_500_000,
      );
      expect(result.parts).toEqual([
        {
          part_number: 3,
          url: expect.stringContaining('partNumber=3') as string,
        },
        {
          part_number: 1,
          url: expect.stringContaining('partNumber=1') as string,
        },
      ]);
      expect(storage.presignUploadPart).toHaveBeenCalledWith(
        'videos/abcdefghijk/source',
        'upload-1',
        3,
        3600,
      );
    });

    it('should reject part numbers above part_count with a 400 validation error', async () => {
      const promise = service.presignParts(video(), [1, 4]);

      await expect(promise).rejects.toBeInstanceOf(
        UploadPartOutOfRangeException,
      );
      await expect(promise).rejects.toMatchObject({
        httpStatus: 400,
        errorCode: 'VALIDATION_ERROR',
      });
      expect(storage.presignUploadPart).not.toHaveBeenCalled();
    });

    it.each(['completed', 'aborted', 'expired'])(
      'should reject every operation with 409 UPLOAD_NOT_ACTIVE when the session is %s',
      async (state) => {
        const v = video();
        v.upload!.state = state as VideoUploadState;

        await expect(service.presignParts(v, [1])).rejects.toBeInstanceOf(
          UploadNotActiveException,
        );
        await expect(service.getUploadState(v)).rejects.toBeInstanceOf(
          UploadNotActiveException,
        );
        await expect(service.completeUpload(v, [])).rejects.toBeInstanceOf(
          UploadNotActiveException,
        );
        await expect(service.abortUpload(v)).rejects.toMatchObject({
          httpStatus: 409,
        });
        expect(storage.listParts).not.toHaveBeenCalled();
        expect(storage.abortMultipartUpload).not.toHaveBeenCalled();
      },
    );

    it('should map ListParts into uploaded_parts for resume', async () => {
      storage.listParts.mockResolvedValueOnce(uploadedParts.slice(0, 2));

      const result = await service.getUploadState(video());

      expect(result).toMatchObject({
        upload_id: 'upload-1',
        state: 'active',
        part_count: 3,
        expected_bytes: 12 * MIB,
        expires_at: '2030-01-01T00:00:00.000Z',
      });
      expect(result.uploaded_parts).toEqual([
        { part_number: 1, etag: '"e1"', size: 5 * MIB },
        { part_number: 2, etag: '"e2"', size: 5 * MIB },
      ]);
    });

    it('should complete the multipart, persist size/states and enqueue video.process inside the transaction', async () => {
      storage.listParts.mockResolvedValueOnce(uploadedParts);

      const result = await service.completeUpload(video(), [
        { part_number: 2, etag: '"e2"' },
        { part_number: 1, etag: '"e1"' },
        { part_number: 3, etag: '"e3"' },
      ]);

      expect(result).toEqual({
        public_id: 'abcdefghijk',
        status: 'draft',
        processing_status: 'processing',
        size_bytes: 12 * MIB,
      });
      expect(storage.completeMultipartUpload).toHaveBeenCalledWith(
        'videos/abcdefghijk/source',
        'upload-1',
        [
          { partNumber: 1, etag: '"e1"' },
          { partNumber: 2, etag: '"e2"' },
          { partNumber: 3, etag: '"e3"' },
        ],
      );
      expect(manager.update).toHaveBeenCalledWith(
        VideoUpload,
        { id: 'session-1' },
        expect.objectContaining({
          state: 'completed',
          completed_at: expect.any(Date) as Date,
        }),
      );
      expect(manager.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /processing_status = 'processing'[\s\S]*processing_status = 'uploading'/,
        ),
        ['video-1', 12 * MIB],
      );
      expect(queue.send).toHaveBeenCalledWith(
        QUEUE_NAMES.VIDEO_PROCESS,
        { videoId: 'video-1' },
        expect.objectContaining({
          singletonKey: 'video:video-1',
          db: expect.objectContaining({
            executeSql: expect.any(Function) as unknown,
          }) as QueueDatabase,
        }),
      );
      // o adaptador roda o SQL do pg-boss no manager da transação
      const [, , sendOptions] = queue.send.mock.calls[0] as [
        unknown,
        unknown,
        { db: QueueDatabase },
      ];
      const { db } = sendOptions;
      manager.query.mockResolvedValueOnce([{ id: 'job-1' }]);
      await expect(db.executeSql('INSERT ...', ['x'])).resolves.toEqual({
        rows: [{ id: 'job-1' }],
      });
      expect(manager.query).toHaveBeenCalledWith('INSERT ...', ['x']);
    });

    it.each([
      [
        'fewer parts than part_count',
        [
          { part_number: 1, etag: '"e1"' },
          { part_number: 2, etag: '"e2"' },
        ],
        uploadedParts,
      ],
      [
        'a part the storage never received',
        [
          { part_number: 1, etag: '"e1"' },
          { part_number: 2, etag: '"e2"' },
          { part_number: 3, etag: '"e3"' },
        ],
        uploadedParts.slice(0, 2),
      ],
      [
        'an etag that differs from the storage',
        [
          { part_number: 1, etag: '"e1"' },
          { part_number: 2, etag: '"deadbeef"' },
          { part_number: 3, etag: '"e3"' },
        ],
        uploadedParts,
      ],
    ])(
      'should reject complete with 422 UPLOAD_INCOMPLETE on %s without touching storage or DB',
      async (_label, parts, stored) => {
        storage.listParts.mockResolvedValueOnce(stored);

        const promise = service.completeUpload(video(), parts);

        await expect(promise).rejects.toBeInstanceOf(UploadIncompleteException);
        await expect(promise).rejects.toMatchObject({ httpStatus: 422 });
        expect(storage.completeMultipartUpload).not.toHaveBeenCalled();
        expect(queue.send).not.toHaveBeenCalled();
        expect(manager.update).not.toHaveBeenCalled();
      },
    );

    it('should reject complete with 413 when the sum of the stored parts exceeds UPLOAD_MAX_BYTES', async () => {
      storage.listParts.mockResolvedValueOnce([
        { partNumber: 1, etag: '"e1"', size: 5 * 1024 * MIB },
        { partNumber: 2, etag: '"e2"', size: 5 * 1024 * MIB },
        { partNumber: 3, etag: '"e3"', size: 1 },
      ]);

      await expect(
        service.completeUpload(video(), [
          { part_number: 1, etag: '"e1"' },
          { part_number: 2, etag: '"e2"' },
          { part_number: 3, etag: '"e3"' },
        ]),
      ).rejects.toBeInstanceOf(VideoTooLargeException);
      expect(storage.completeMultipartUpload).not.toHaveBeenCalled();
    });

    it('should abort the multipart, mark the session aborted and delete the draft', async () => {
      await service.abortUpload(video());

      expect(storage.abortMultipartUpload).toHaveBeenCalledWith(
        'videos/abcdefghijk/source',
        'upload-1',
      );
      expect(manager.update).toHaveBeenCalledWith(
        VideoUpload,
        { id: 'session-1' },
        { state: 'aborted' },
      );
      expect(manager.delete).toHaveBeenCalledWith(Video, { id: 'video-1' });
    });
  });
  describe('read endpoints (getVideo / getPlayback)', () => {
    const readyVideo = (): Video =>
      ({
        id: 'video-1',
        public_id: 'abcdefghijk',
        status: 'draft',
        processing_status: 'ready',
        processing_error: null,
        original_filename: 'meu "video".mp4',
        content_type: 'video/mp4',
        size_bytes: 12 * MIB,
        duration_seconds: 2.04,
        width: 320,
        height: 240,
        container: 'mp4',
        video_codec: 'h264',
        audio_codec: 'aac',
        storage_key: 'videos/abcdefghijk/source',
        thumbnail_key: 'thumbnails/abcdefghijk/auto.jpg',
        created_at: new Date('2026-10-18T10:00:00.000Z'),
        processed_at: new Date('2026-10-18T10:01:00.000Z'),
        upload: null,
      }) as unknown as Video;

    it('should map the video state with a public presigned thumbnail_url and ISO dates', async () => {
      const result = await service.getVideo(readyVideo());

      expect(result).toMatchObject({
        public_id: 'abcdefghijk',
        processing_status: 'ready',
        processing_error: null,
        duration_seconds: 2.04,
        container: 'mp4',
        video_codec: 'h264',
        audio_codec: 'aac',
        created_at: '2026-10-18T10:00:00.000Z',
        processed_at: '2026-10-18T10:01:00.000Z',
      });
      expect(result.thumbnail_url).toContain('thumbnails/abcdefghijk/auto.jpg');
      expect(storage.presignGetObject).toHaveBeenCalledWith(
        'thumbnails/abcdefghijk/auto.jpg',
        43200,
        { public: true },
      );
    });

    it('should return thumbnail_url null and processed_at null while uploading, without presigning', async () => {
      const video = readyVideo();
      Object.assign(video, {
        processing_status: 'uploading',
        thumbnail_key: null,
        processed_at: null,
      });

      const result = await service.getVideo(video);

      expect(result.thumbnail_url).toBeNull();
      expect(result.processed_at).toBeNull();
      expect(storage.presignGetObject).not.toHaveBeenCalled();
    });

    it.each(['uploading', 'processing', 'failed'])(
      'should refuse playback with 409 VIDEO_NOT_READY when processing_status is %s',
      async (status) => {
        const video = readyVideo();
        Object.assign(video, { processing_status: status });

        const promise = service.getPlayback(video);

        await expect(promise).rejects.toBeInstanceOf(VideoNotReadyException);
        await expect(promise).rejects.toMatchObject({
          httpStatus: 409,
          errorCode: 'VIDEO_NOT_READY',
        });
        expect(storage.presignGetObject).not.toHaveBeenCalled();
      },
    );

    it('should sign stream, download (sanitized attachment filename) and thumbnail with the public client and PLAYBACK_URL_TTL', async () => {
      const result = await service.getPlayback(readyVideo());

      expect(storage.presignGetObject).toHaveBeenCalledWith(
        'videos/abcdefghijk/source',
        43200,
        { public: true },
      );
      expect(storage.presignGetObject).toHaveBeenCalledWith(
        'videos/abcdefghijk/source',
        43200,
        {
          public: true,
          responseContentDisposition: 'attachment; filename="meu video.mp4"',
        },
      );
      expect(storage.presignGetObject).toHaveBeenCalledWith(
        'thumbnails/abcdefghijk/auto.jpg',
        43200,
        { public: true },
      );
      expect(result.stream_url).toContain('videos/abcdefghijk/source');
      expect(result.download_url).toContain('response-content-disposition=');
      expect(result.thumbnail_url).toContain('auto.jpg');
      const expiresAt = new Date(result.expires_at).getTime();
      expect(expiresAt).toBeGreaterThan(Date.now() + 43_000_000);
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + 43_200_000);
    });
  });
});
