import type { S3Client } from '@aws-sdk/client-s3';
import { Test, type TestingModule } from '@nestjs/testing';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { DataSource, Repository } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import { QUEUE_NAMES, singletonKeys } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { S3_INTERNAL_CLIENT } from '../storage/storage.constants';
import { StorageService } from '../storage/storage.service';
import { cleanAllTables } from '../test/create-test-data-source';
import { abortAllMultipart, cleanPrefix } from '../test/storage';
import { videoFixture, type VideoFixtureName } from '../test/video-fixtures';
import { User } from '../users/entities/user.entity';
import { Video } from '../videos/entities/video.entity';
import { generatePublicId, storageKeys } from '../videos/public-id.util';
import { FfmpegService } from './ffmpeg.service';
import { VideoProcessingWorker } from './video-processing.worker';
import { ProbeFailedError } from './worker.errors';
import { WorkerModule } from './worker.module';

async function waitFor<T>(
  probe: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs: number,
  intervalMs = 500,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = await probe();
  while (!predicate(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    last = await probe();
  }
  return last;
}

describe('VideoProcessingWorker (integration — DB, RustFS, pg-boss e ffmpeg reais)', () => {
  let module: TestingModule;
  let worker: VideoProcessingWorker;
  let ffmpeg: FfmpegService;
  let storage: StorageService;
  let queue: QueueService;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let channel: Channel;

  beforeAll(async () => {
    // WorkerModule standalone: o init registra `work` em video.process no schema de testes.
    module = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();
    await module.init();
    worker = module.get(VideoProcessingWorker);
    ffmpeg = module.get(FfmpegService);
    storage = module.get(StorageService);
    queue = module.get(QueueService);
    dataSource = module.get(DataSource);
    videoRepository = dataSource.getRepository(Video);
  }, 60000);

  afterAll(async () => {
    const s3 = module.get<S3Client>(S3_INTERNAL_CLIENT);
    await abortAllMultipart(s3, process.env.S3_BUCKET!, 'videos/');
    await cleanPrefix(s3, process.env.S3_BUCKET!, 'videos/');
    await cleanPrefix(s3, process.env.S3_BUCKET!, 'thumbnails/');
    await module.close();
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await cleanAllTables(dataSource);
    const user = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: 'worker-int@example.com',
        password: 'hashed',
        is_confirmed: true,
      }),
    );
    channel = await dataSource
      .getRepository(Channel)
      .save(
        dataSource
          .getRepository(Channel)
          .create({ name: 'Worker', nickname: 'worker_int', user_id: user.id }),
      );
  });

  /** Vídeo em `processing` com o objeto da fixture já montado no storage (como após o complete). */
  async function seedProcessingVideo(
    fixture: VideoFixtureName | null,
    overrides: Partial<Video> = {},
  ): Promise<Video> {
    const publicId = generatePublicId();
    const keys = storageKeys(publicId);
    let contentType = 'video/mp4';
    let size = 0;
    if (fixture) {
      const file = await videoFixture(fixture);
      contentType = file.contentType;
      size = file.buffer.length;
      await storage.putObject(keys.source, file.buffer, contentType);
    }
    return videoRepository.save(
      videoRepository.create({
        public_id: publicId,
        channel_id: channel.id,
        original_filename: `${fixture ?? 'missing'}.bin`,
        content_type: contentType,
        size_bytes: size,
        storage_key: keys.source,
        processing_status: 'processing',
        ...overrides,
      }),
    );
  }

  const job = (video: Video, retryCount = 0) => ({
    id: `job-${video.id}-${retryCount}`,
    name: QUEUE_NAMES.VIDEO_PROCESS,
    data: { videoId: video.id },
    retryCount,
  });

  async function tmpThumbnails(): Promise<string[]> {
    return (await readdir(tmpdir())).filter((f) =>
      f.startsWith('streamtube-thumb-'),
    );
  }

  it('should take a valid MP4 (h264/aac) to ready with metadata and an existing thumbnail, leaving no temp file', async () => {
    const video = await seedProcessingVideo('mp4-h264-aac');

    await worker.handle(job(video));

    const stored = await videoRepository.findOneByOrFail({ id: video.id });
    expect(stored.processing_status).toBe('ready');
    expect(stored.processing_error).toBeNull();
    expect(stored.container).toBe('mp4');
    expect(stored.video_codec).toBe('h264');
    expect(stored.audio_codec).toBe('aac');
    expect(stored.width).toBe(320);
    expect(stored.height).toBe(240);
    expect(stored.duration_seconds).toBeGreaterThan(1.8);
    expect(stored.duration_seconds).toBeLessThan(2.3);
    expect(stored.processed_at).toBeInstanceOf(Date);
    expect(stored.thumbnail_key).toBe(`thumbnails/${video.public_id}/auto.jpg`);
    await expect(
      storage.headObject(stored.thumbnail_key!),
    ).resolves.toMatchObject({ contentType: 'image/jpeg' });
    const head = await storage.headObject(stored.thumbnail_key!);
    expect(head!.contentLength).toBeGreaterThan(1024);
    await expect(tmpThumbnails()).resolves.toEqual([]);
  }, 120000);

  it('should take a WebM (vp9/opus) to ready with container webm', async () => {
    const video = await seedProcessingVideo('webm-vp9-opus');

    await worker.handle(job(video));

    const stored = await videoRepository.findOneByOrFail({ id: video.id });
    expect(stored.processing_status).toBe('ready');
    expect(stored).toMatchObject({
      container: 'webm',
      video_codec: 'vp9',
      audio_codec: 'opus',
    });
  }, 120000);

  it('should take a video without audio to ready with audio_codec null', async () => {
    const video = await seedProcessingVideo('mp4-h264-noaudio');

    await worker.handle(job(video));

    const stored = await videoRepository.findOneByOrFail({ id: video.id });
    expect(stored.processing_status).toBe('ready');
    expect(stored.audio_codec).toBeNull();
    expect(stored.video_codec).toBe('h264');
  }, 120000);

  it('should mark an MKV/HEVC as failed + UNSUPPORTED_FORMAT on the first attempt without throwing (no retry)', async () => {
    const video = await seedProcessingVideo('mkv-hevc-aac');
    const extract = jest.spyOn(ffmpeg, 'extractFrame');

    await expect(worker.handle(job(video))).resolves.toBeUndefined();

    const stored = await videoRepository.findOneByOrFail({ id: video.id });
    expect(stored.processing_status).toBe('failed');
    expect(stored.processing_error).toBe('UNSUPPORTED_FORMAT');
    expect(stored.processing_error_detail).toMatch(/hevc/);
    expect(stored.processed_at).toBeInstanceOf(Date);
    expect(stored.thumbnail_key).toBeNull();
    expect(extract).not.toHaveBeenCalled();
  }, 120000);

  it('should mark a video whose object is missing as failed + OBJECT_MISSING without probing', async () => {
    const video = await seedProcessingVideo(null);
    const probe = jest.spyOn(ffmpeg, 'probe');

    await expect(worker.handle(job(video))).resolves.toBeUndefined();

    const stored = await videoRepository.findOneByOrFail({ id: video.id });
    expect(stored.processing_status).toBe('failed');
    expect(stored.processing_error).toBe('OBJECT_MISSING');
    expect(stored.processing_error_detail).toContain(video.storage_key);
    expect(probe).not.toHaveBeenCalled();
  }, 60000);

  it('should rethrow a probe failure for retry while attempts remain, keeping the video in processing', async () => {
    const video = await seedProcessingVideo('mp4-h264-aac');
    jest
      .spyOn(ffmpeg, 'probe')
      .mockRejectedValue(
        new ProbeFailedError('timed out after 60000 ms (SIGTERM)'),
      );

    await expect(worker.handle(job(video, 0))).rejects.toBeInstanceOf(
      ProbeFailedError,
    );

    const stored = await videoRepository.findOneByOrFail({ id: video.id });
    expect(stored.processing_status).toBe('processing');
    expect(stored.processing_error).toBeNull();
  }, 60000);

  it('should mark failed + PROBE_FAILED with detail on the last attempt (retryCount = retryLimit) without throwing', async () => {
    const video = await seedProcessingVideo('mp4-h264-aac');
    jest
      .spyOn(ffmpeg, 'probe')
      .mockRejectedValue(
        new ProbeFailedError('timed out after 60000 ms (SIGTERM)'),
      );

    await expect(worker.handle(job(video, 3))).resolves.toBeUndefined();

    const stored = await videoRepository.findOneByOrFail({ id: video.id });
    expect(stored.processing_status).toBe('failed');
    expect(stored.processing_error).toBe('PROBE_FAILED');
    expect(stored.processing_error_detail).toContain('timed out');
  }, 60000);

  it('should mark failed + THUMBNAIL_FAILED on the last attempt when frame extraction fails, and remove the temp file', async () => {
    const video = await seedProcessingVideo('mp4-h264-aac');
    jest
      .spyOn(ffmpeg, 'extractFrame')
      .mockRejectedValue(new Error('ffmpeg exploded'));

    await expect(worker.handle(job(video, 3))).resolves.toBeUndefined();

    const stored = await videoRepository.findOneByOrFail({ id: video.id });
    expect(stored.processing_status).toBe('failed');
    expect(stored.processing_error).toBe('THUMBNAIL_FAILED');
    expect(stored.processing_error_detail).toContain('ffmpeg exploded');
    await expect(tmpThumbnails()).resolves.toEqual([]);
  }, 60000);

  it('should be a no-op for a video that is already ready (no column changes, no ffmpeg calls)', async () => {
    const video = await seedProcessingVideo('mp4-h264-aac');
    await worker.handle(job(video));
    const before = await videoRepository.findOneByOrFail({ id: video.id });
    const probe = jest.spyOn(ffmpeg, 'probe');

    await worker.handle(job(video));

    const after = await videoRepository.findOneByOrFail({ id: video.id });
    expect(after).toEqual(before);
    expect(probe).not.toHaveBeenCalled();
  }, 120000);

  it('should consume a job sent through the real queue and finish the video as ready', async () => {
    const video = await seedProcessingVideo('mp4-h264-aac');

    const jobId = await queue.send(
      QUEUE_NAMES.VIDEO_PROCESS,
      { videoId: video.id },
      { singletonKey: singletonKeys.videoProcess(video.id) },
    );

    expect(jobId).toEqual(expect.any(String));
    const stored = await waitFor(
      () => videoRepository.findOneByOrFail({ id: video.id }),
      (v) => v.processing_status !== 'processing',
      60000,
    );
    expect(stored.processing_status).toBe('ready');
    const state = await waitFor(
      () => queue.getJob(QUEUE_NAMES.VIDEO_PROCESS, jobId!),
      (j) => j?.state === 'completed',
      15000,
    );
    expect(state?.state).toBe('completed');
  }, 120000);
});
