import { Test } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { ChannelsService } from '../channels/channels.service';
import uploadConfig from '../config/upload.config';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { type QueueDatabase, QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import type { CreateVideoDto } from './dto/create-video.dto';
import { VideoUpload } from './entities/video-upload.entity';
import { Video } from './entities/video.entity';
import {
  CategoryNotFoundException,
  UploadIncompleteException,
  UploadNotActiveException,
  UploadPartOutOfRangeException,
  VideoNotPublishableException,
  VideoNotReadyException,
  VideoTooLargeException,
  VideoUnsupportedMediaTypeException,
} from './videos.exceptions';
import type { VideoUploadState } from './videos.constants';
import { ThumbnailProcessor } from './thumbnail.processor';
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
    publicUrl: jest.Mock;
  };
  let queue: { send: jest.Mock };
  let channels: { findByUserId: jest.Mock };
  let categories: { findById: jest.Mock };
  let videoRepo: { update: jest.Mock; findOneOrFail: jest.Mock };

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
      publicUrl: jest.fn(
        (key: string) => `http://localhost:9000/streamtube-videos/${key}`,
      ),
    };
    queue = { send: jest.fn().mockResolvedValue('job-1') };
    channels = {
      findByUserId: jest.fn().mockResolvedValue({ id: 'channel-1' }),
    };
    categories = { findById: jest.fn().mockResolvedValue(null) };
    videoRepo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOneOrFail: jest.fn().mockResolvedValue({
        id: 'video-1',
        updated_at: new Date('2026-10-19T09:00:00.000Z'),
      }),
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
            getRepository: jest.fn(() => videoRepo),
          },
        },
        { provide: ChannelsService, useValue: channels },
        { provide: CategoriesService, useValue: categories },
        ThumbnailProcessor,
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

  it('should derive the draft title from original_filename without its last extension', async () => {
    await service.createUpload('user-1', {
      ...dto,
      original_filename: 'Minha aula.final.mp4',
    });

    expect(manager.create).toHaveBeenCalledWith(
      Video,
      expect.objectContaining({
        original_filename: 'Minha aula.final.mp4',
        title: 'Minha aula.final',
      }),
    );
  });

  it('should truncate the derived title to 100 characters', async () => {
    await service.createUpload('user-1', {
      ...dto,
      original_filename: `${'t'.repeat(180)}.mp4`,
    });

    expect(manager.create).toHaveBeenCalledWith(
      Video,
      expect.objectContaining({ title: 't'.repeat(100) }),
    );
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
        updated_at: new Date('2026-10-18T10:02:00.000Z'),
        upload: null,
      }) as unknown as Video;

    it('should map the video state with a stable public thumbnail_url and ISO dates', async () => {
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
      expect(result.thumbnail_url).toBe(
        `http://localhost:9000/streamtube-videos/thumbnails/abcdefghijk/auto.jpg?v=${Date.parse('2026-10-18T10:02:00.000Z')}`,
      );
      expect(storage.presignGetObject).not.toHaveBeenCalled();
    });

    it('should expose the editorial fields and counters of a fresh draft', async () => {
      const video = readyVideo();
      Object.assign(video, {
        title: 'meu "video"',
        description: null,
        visibility: 'public',
        category_id: null,
        category: null,
        custom_thumbnail_key: null,
        view_count: 0,
        like_count: 0,
        dislike_count: 0,
        comment_count: 0,
        published_at: null,
      });

      const result = await service.getVideo(video);

      expect(result).toMatchObject({
        title: 'meu "video"',
        description: null,
        status: 'draft',
        visibility: 'public',
        category: null,
        has_custom_thumbnail: false,
        view_count: 0,
        like_count: 0,
        dislike_count: 0,
        comment_count: 0,
        published_at: null,
      });
      expect(categories.findById).not.toHaveBeenCalled();
    });

    it('should map the loaded category, the custom thumbnail flag and published_at', async () => {
      const video = readyVideo();
      Object.assign(video, {
        category_id: 'cat-7',
        category: {
          id: 'cat-7',
          slug: 'technology',
          name: 'Technology',
          sort_order: 7,
          created_at: new Date(),
          updated_at: new Date(),
        },
        custom_thumbnail_key: 'thumbnails/abcdefghijk/custom.jpg',
        published_at: new Date('2026-10-18T12:00:00.000Z'),
      });

      const result = await service.getVideo(video);

      expect(result.category).toEqual({
        id: 'cat-7',
        slug: 'technology',
        name: 'Technology',
        sort_order: 7,
      });
      expect(result.has_custom_thumbnail).toBe(true);
      expect(result.published_at).toBe('2026-10-18T12:00:00.000Z');
      expect(categories.findById).not.toHaveBeenCalled();
    });

    it('should look the category up by id when the relation was not loaded', async () => {
      categories.findById.mockResolvedValueOnce({
        id: 'cat-1',
        slug: 'music',
        name: 'Music',
        sort_order: 1,
      });
      const video = readyVideo();
      Object.assign(video, { category_id: 'cat-1' });

      const result = await service.getVideo(video);

      expect(categories.findById).toHaveBeenCalledWith('cat-1');
      expect(result.category).toEqual({
        id: 'cat-1',
        slug: 'music',
        name: 'Music',
        sort_order: 1,
      });
    });

    it('should return thumbnail_url null and processed_at null while uploading', async () => {
      const video = readyVideo();
      Object.assign(video, {
        processing_status: 'uploading',
        thumbnail_key: null,
        processed_at: null,
      });

      const result = await service.getVideo(video);

      expect(result.thumbnail_url).toBeNull();
      expect(result.processed_at).toBeNull();
      expect(storage.publicUrl).not.toHaveBeenCalled();
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

    it('should sign stream and download (sanitized attachment filename) with the public client and PLAYBACK_URL_TTL, and return the stable thumbnail', async () => {
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
      expect(storage.presignGetObject).toHaveBeenCalledTimes(2);
      expect(result.stream_url).toContain('videos/abcdefghijk/source');
      expect(result.download_url).toContain('response-content-disposition=');
      expect(result.thumbnail_url).toMatch(
        /\/thumbnails\/abcdefghijk\/auto\.jpg\?v=\d+$/,
      );
      expect(result.thumbnail_url).not.toContain('X-Amz');
      const expiresAt = new Date(result.expires_at).getTime();
      expect(expiresAt).toBeGreaterThan(Date.now() + 43_000_000);
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + 43_200_000);
    });
  });
  describe('editorial edits and publication (updateVideo / publish / unpublish)', () => {
    const editable = (overrides: Partial<Video> = {}): Video =>
      ({
        id: 'video-1',
        public_id: 'abcdefghijk',
        status: 'draft',
        visibility: 'public',
        processing_status: 'ready',
        processing_error: null,
        title: 'aula',
        description: null,
        category_id: null,
        category: null,
        original_filename: 'aula.mp4',
        content_type: 'video/mp4',
        size_bytes: MIB,
        duration_seconds: 2,
        width: 320,
        height: 240,
        container: 'mp4',
        video_codec: 'h264',
        audio_codec: 'aac',
        storage_key: 'videos/abcdefghijk/source',
        thumbnail_key: null,
        custom_thumbnail_key: null,
        view_count: 0,
        like_count: 0,
        dislike_count: 0,
        comment_count: 0,
        published_at: null,
        created_at: new Date('2026-10-18T10:00:00.000Z'),
        processed_at: new Date('2026-10-18T10:01:00.000Z'),
        updated_at: new Date('2026-10-18T10:02:00.000Z'),
        upload: null,
        ...overrides,
      }) as unknown as Video;

    it('should update only the fields present and never touch status', async () => {
      const video = editable();

      const result = await service.updateVideo(video, {
        title: 'Novo',
        visibility: 'unlisted',
      });

      expect(videoRepo.update).toHaveBeenCalledWith('video-1', {
        title: 'Novo',
        visibility: 'unlisted',
      });
      expect(result).toMatchObject({
        title: 'Novo',
        visibility: 'unlisted',
        status: 'draft',
        description: null,
      });
    });

    it('should reject an unknown category_id with CATEGORY_NOT_FOUND before writing', async () => {
      categories.findById.mockResolvedValueOnce(null);

      const promise = service.updateVideo(editable(), {
        category_id: '00000000-0000-4000-8000-000000000000',
      });

      await expect(promise).rejects.toBeInstanceOf(CategoryNotFoundException);
      await expect(promise).rejects.toMatchObject({
        httpStatus: 400,
        errorCode: 'CATEGORY_NOT_FOUND',
      });
      expect(videoRepo.update).not.toHaveBeenCalled();
    });

    it('should set an existing category and expose it in the response', async () => {
      const music = {
        id: 'cat-1',
        slug: 'music',
        name: 'Music',
        sort_order: 1,
      };
      categories.findById.mockResolvedValueOnce(music);

      const result = await service.updateVideo(editable(), {
        category_id: 'cat-1',
      });

      expect(videoRepo.update).toHaveBeenCalledWith('video-1', {
        category_id: 'cat-1',
      });
      expect(result.category).toEqual(music);
    });

    it('should clear description and category with null', async () => {
      const video = editable({
        description: 'old',
        category_id: 'cat-1',
      } as Partial<Video>);

      const result = await service.updateVideo(video, {
        description: null,
        category_id: null,
      });

      expect(categories.findById).not.toHaveBeenCalled();
      expect(videoRepo.update).toHaveBeenCalledWith('video-1', {
        description: null,
        category_id: null,
      });
      expect(result.description).toBeNull();
      expect(result.category).toBeNull();
    });

    it.each(['uploading', 'processing', 'failed'] as const)(
      'should refuse to publish with VIDEO_NOT_PUBLISHABLE while processing_status is %s',
      async (processingStatus) => {
        const promise = service.publish(
          editable({ processing_status: processingStatus }),
        );

        await expect(promise).rejects.toBeInstanceOf(
          VideoNotPublishableException,
        );
        await expect(promise).rejects.toMatchObject({
          httpStatus: 409,
          errorCode: 'VIDEO_NOT_PUBLISHABLE',
        });
        expect(videoRepo.update).not.toHaveBeenCalled();
      },
    );

    it('should refuse to publish a ready video with a blank title', async () => {
      await expect(
        service.publish(editable({ title: '   ' })),
      ).rejects.toBeInstanceOf(VideoNotPublishableException);
      expect(videoRepo.update).not.toHaveBeenCalled();
    });

    it('should publish a ready draft and stamp published_at on the first publication', async () => {
      const before = Date.now();

      const result = await service.publish(editable());

      const [, changes] = videoRepo.update.mock.calls[0] as [
        string,
        { status: string; published_at: Date },
      ];
      expect(changes.status).toBe('published');
      expect(changes.published_at.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.status).toBe('published');
      expect(result.published_at).toBe(changes.published_at.toISOString());
    });

    it('should keep the original published_at when republishing an unpublished video', async () => {
      const firstPublication = new Date('2026-10-01T08:00:00.000Z');

      const result = await service.publish(
        editable({ published_at: firstPublication }),
      );

      expect(videoRepo.update).toHaveBeenCalledWith('video-1', {
        status: 'published',
        published_at: firstPublication,
      });
      expect(result.published_at).toBe('2026-10-01T08:00:00.000Z');
    });

    it('should be idempotent for an already published video', async () => {
      const result = await service.publish(
        editable({
          status: 'published',
          published_at: new Date('2026-10-01T08:00:00.000Z'),
        }),
      );

      expect(videoRepo.update).not.toHaveBeenCalled();
      expect(result.published_at).toBe('2026-10-01T08:00:00.000Z');
    });

    it('should unpublish keeping visibility and published_at', async () => {
      const result = await service.unpublish(
        editable({
          status: 'published',
          visibility: 'unlisted',
          published_at: new Date('2026-10-01T08:00:00.000Z'),
        }),
      );

      expect(videoRepo.update).toHaveBeenCalledWith('video-1', {
        status: 'draft',
      });
      expect(result).toMatchObject({
        status: 'draft',
        visibility: 'unlisted',
        published_at: '2026-10-01T08:00:00.000Z',
      });
    });

    it('should be idempotent when unpublishing a draft', async () => {
      const result = await service.unpublish(editable());

      expect(videoRepo.update).not.toHaveBeenCalled();
      expect(result.status).toBe('draft');
    });
  });
  describe('thumbnailUrl (stable public URL — TD-10)', () => {
    const keys = (
      overrides: Partial<
        Pick<Video, 'custom_thumbnail_key' | 'thumbnail_key' | 'updated_at'>
      > = {},
    ) => ({
      custom_thumbnail_key: null,
      thumbnail_key: 'thumbnails/abcdefghijk/auto.jpg',
      updated_at: new Date('2026-10-19T09:00:00.000Z'),
      ...overrides,
    });

    it('should prefer the custom thumbnail over the automatic one', () => {
      const url = service.thumbnailUrl(
        keys({ custom_thumbnail_key: 'thumbnails/abcdefghijk/custom.jpg' }),
      );

      expect(url).toBe(
        `http://localhost:9000/streamtube-videos/thumbnails/abcdefghijk/custom.jpg?v=${Date.parse('2026-10-19T09:00:00.000Z')}`,
      );
    });

    it('should fall back to the automatic thumbnail', () => {
      expect(service.thumbnailUrl(keys())).toContain(
        '/thumbnails/abcdefghijk/auto.jpg?v=',
      );
    });

    it('should return null when there is no thumbnail at all', () => {
      expect(service.thumbnailUrl(keys({ thumbnail_key: null }))).toBeNull();
    });

    it('should change the ?v= cache-buster when updated_at changes', () => {
      const before = service.thumbnailUrl(keys());
      const after = service.thumbnailUrl(
        keys({ updated_at: new Date('2026-10-19T09:00:01.000Z') }),
      );

      expect(after).not.toBe(before);
      expect(after!.split('?')[0]).toBe(before!.split('?')[0]);
    });

    it('should use the updated_at re-read after a write in the response', async () => {
      const video = {
        id: 'video-1',
        public_id: 'abcdefghijk',
        status: 'draft',
        visibility: 'public',
        processing_status: 'ready',
        processing_error: null,
        title: 'aula',
        description: null,
        category_id: null,
        category: null,
        original_filename: 'aula.mp4',
        content_type: 'video/mp4',
        thumbnail_key: 'thumbnails/abcdefghijk/auto.jpg',
        custom_thumbnail_key: null,
        published_at: null,
        created_at: new Date('2026-10-18T10:00:00.000Z'),
        processed_at: null,
        updated_at: new Date('2026-10-18T10:02:00.000Z'),
      } as unknown as Video;

      const result = await service.updateVideo(video, { title: 'Novo' });

      expect(videoRepo.findOneOrFail).toHaveBeenCalledWith({
        where: { id: 'video-1' },
        select: { id: true, updated_at: true },
      });
      expect(result.thumbnail_url).toContain(
        `?v=${Date.parse('2026-10-19T09:00:00.000Z')}`,
      );
    });
  });
  describe('deleteVideo (TD-09)', () => {
    const deletable = (overrides: Record<string, unknown> = {}): Video =>
      ({
        id: 'video-1',
        public_id: 'abcdefghijk',
        storage_key: 'videos/abcdefghijk/source',
        thumbnail_key: 'thumbnails/abcdefghijk/auto.jpg',
        custom_thumbnail_key: 'thumbnails/abcdefghijk/custom.jpg',
        upload: { id: 'session-1', upload_id: 'upload-1', state: 'completed' },
        ...overrides,
      }) as unknown as Video;

    it('should delete the row and enqueue video.delete with every non-null key in the same transaction', async () => {
      await service.deleteVideo(deletable());

      expect(manager.delete).toHaveBeenCalledWith(Video, { id: 'video-1' });
      expect(queue.send).toHaveBeenCalledWith(
        QUEUE_NAMES.VIDEO_DELETE,
        {
          videoId: 'video-1',
          publicId: 'abcdefghijk',
          storageKey: 'videos/abcdefghijk/source',
          thumbnailKeys: [
            'thumbnails/abcdefghijk/auto.jpg',
            'thumbnails/abcdefghijk/custom.jpg',
          ],
        },
        expect.objectContaining({
          singletonKey: 'video-delete:video-1',
          db: expect.anything() as unknown,
        }),
      );
      expect(storage.abortMultipartUpload).not.toHaveBeenCalled();
    });

    it('should list only the automatic thumbnail when there is no custom one', async () => {
      await service.deleteVideo(deletable({ custom_thumbnail_key: null }));

      const [, payload] = queue.send.mock.calls[0] as [
        string,
        { thumbnailKeys: string[] },
      ];
      expect(payload.thumbnailKeys).toEqual([
        'thumbnails/abcdefghijk/auto.jpg',
      ]);
    });

    it('should send an empty thumbnail list for a video that never got a thumbnail', async () => {
      await service.deleteVideo(
        deletable({ thumbnail_key: null, custom_thumbnail_key: null }),
      );

      const [, payload] = queue.send.mock.calls[0] as [
        string,
        { thumbnailKeys: string[] },
      ];
      expect(payload.thumbnailKeys).toEqual([]);
    });

    it('should abort an active multipart session before touching the database', async () => {
      const order: string[] = [];
      storage.abortMultipartUpload.mockImplementationOnce(() => {
        order.push('abort');
        return Promise.resolve();
      });
      manager.delete.mockImplementationOnce(() => {
        order.push('delete');
        return Promise.resolve({ affected: 1 });
      });

      await service.deleteVideo(
        deletable({
          upload: { id: 'session-1', upload_id: 'upload-1', state: 'active' },
        }),
      );

      expect(storage.abortMultipartUpload).toHaveBeenCalledWith(
        'videos/abcdefghijk/source',
        'upload-1',
      );
      expect(order).toEqual(['abort', 'delete']);
    });

    it('should leave the database untouched when aborting the session fails', async () => {
      storage.abortMultipartUpload.mockRejectedValueOnce(
        new Error('storage down'),
      );

      await expect(
        service.deleteVideo(
          deletable({
            upload: { id: 'session-1', upload_id: 'upload-1', state: 'active' },
          }),
        ),
      ).rejects.toThrow('storage down');
      expect(manager.delete).not.toHaveBeenCalled();
      expect(queue.send).not.toHaveBeenCalled();
    });

    it('should not abort when there is no upload session', async () => {
      await service.deleteVideo(deletable({ upload: null }));

      expect(storage.abortMultipartUpload).not.toHaveBeenCalled();
      expect(manager.delete).toHaveBeenCalled();
    });
  });
});
