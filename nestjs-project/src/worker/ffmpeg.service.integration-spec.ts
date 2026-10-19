import type { S3Client } from '@aws-sdk/client-s3';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import storageConfig from '../config/storage.config';
import { S3_INTERNAL_CLIENT } from '../storage/storage.constants';
import { StorageModule } from '../storage/storage.module';
import { StorageService } from '../storage/storage.service';
import { cleanPrefix, testKeyPrefix } from '../test/storage';
import { videoFixture } from '../test/video-fixtures';
import { FfmpegService } from './ffmpeg.service';
import { ProbeFailedError } from './worker.errors';

describe('FfmpegService (integration — ffmpeg real lendo do RustFS por URL assinada)', () => {
  let module: TestingModule;
  let storage: StorageService;
  let ffmpeg: FfmpegService;
  const prefix = testKeyPrefix('ffmpeg');
  const key = `${prefix}source.mp4`;
  const thumbPath = join(tmpdir(), 'streamtube-ffmpeg-int-thumb.jpg');

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [storageConfig] }),
        StorageModule,
      ],
      providers: [FfmpegService],
    }).compile();
    storage = module.get(StorageService);
    ffmpeg = module.get(FfmpegService);

    const fixture = await videoFixture('mp4-h264-aac');
    await storage.putObject(key, fixture.buffer, fixture.contentType);
  }, 120000);

  afterAll(async () => {
    await cleanPrefix(
      module.get<S3Client>(S3_INTERNAL_CLIENT),
      process.env.S3_BUCKET!,
      prefix,
    );
    await rm(thumbPath, { force: true });
    await module.close();
  });

  it('should probe the MP4 through the internal presigned URL: ~2 s, h264 video, aac audio', async () => {
    const url = await storage.presignGetObject(key, 600, { public: false });

    const result = await ffmpeg.probe(url);

    expect(result.formatName).toContain('mp4');
    expect(result.durationSeconds).toBeGreaterThan(1.8);
    expect(result.durationSeconds).toBeLessThan(2.3);
    expect(result.videoStream).toEqual({
      codec: 'h264',
      width: 320,
      height: 240,
    });
    expect(result.audioStream).toEqual({ codec: 'aac' });
  }, 60000);

  it('should extract a JPEG frame larger than 1 KB at the requested instant', async () => {
    const url = await storage.presignGetObject(key, 600, { public: false });

    await ffmpeg.extractFrame(url, 0.2, thumbPath);

    const info = await stat(thumbPath);
    expect(info.size).toBeGreaterThan(1024);
    const head = await readFile(thumbPath);
    expect(head.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff])); // JPEG SOI
  }, 120000);

  it('should fail with ProbeFailedError when the object does not exist (storage returns 404)', async () => {
    const url = await storage.presignGetObject(`${prefix}missing.mp4`, 600, {
      public: false,
    });

    await expect(ffmpeg.probe(url)).rejects.toBeInstanceOf(ProbeFailedError);
  }, 60000);
});
