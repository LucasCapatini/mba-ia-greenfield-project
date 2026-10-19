import type { S3Client } from '@aws-sdk/client-s3';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import appConfig from '../config/app.config';
import databaseConfig from '../config/database.config';
import queueConfig from '../config/queue.config';
import storageConfig from '../config/storage.config';
import uploadConfig from '../config/upload.config';
import { S3_INTERNAL_CLIENT } from '../storage/storage.constants';
import { StorageService } from '../storage/storage.service';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import {
  abortAllMultipart,
  cleanPrefix,
  deterministicBuffer,
  putPart,
} from '../test/storage';
import { videoFixture } from '../test/video-fixtures';
import { User } from '../users/entities/user.entity';
import { VideoUpload } from './entities/video-upload.entity';
import { Video } from './entities/video.entity';
import { VideosModule } from './videos.module';
import { VideosService } from './videos.service';

const MIB = 1024 * 1024;
const QUEUE_SCHEMA = process.env.QUEUE_SCHEMA ?? 'pgboss';

type JobRow = { singleton_key: string; state: string; retry_limit: number };

describe('VideosService (integration — DB + RustFS + pg-boss reais)', () => {
  let module: TestingModule;
  let service: VideosService;
  let storage: StorageService;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let uploadRepository: Repository<VideoUpload>;
  let user: User;
  const createdKeys: string[] = [];

  beforeAll(async () => {
    process.env.UPLOAD_PART_SIZE = String(5 * MIB);
    process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT;

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            appConfig,
            databaseConfig,
            storageConfig,
            uploadConfig,
            queueConfig,
          ],
        }),
        TypeOrmModule.forRoot(
          createTestDataSource(ALL_ENTITIES, { synchronize: false }).options,
        ),
        VideosModule,
      ],
    }).compile();
    await module.init();

    service = module.get(VideosService);
    storage = module.get(StorageService);
    dataSource = module.get(DataSource);
    videoRepository = dataSource.getRepository(Video);
    uploadRepository = dataSource.getRepository(VideoUpload);
  }, 30000);

  afterAll(async () => {
    const client = module.get<S3Client>(S3_INTERNAL_CLIENT);
    for (const key of createdKeys) {
      await abortAllMultipart(client, process.env.S3_BUCKET!, key);
      await cleanPrefix(client, process.env.S3_BUCKET!, key);
    }
    await module.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    const userRepository = dataSource.getRepository(User);
    const channelRepository = dataSource.getRepository(Channel);
    user = await userRepository.save(
      userRepository.create({
        email: 'owner-int@example.com',
        password: 'hashed',
        is_confirmed: true,
      }),
    );
    await channelRepository.save(
      channelRepository.create({
        name: 'Owner',
        nickname: 'owner_int',
        user_id: user.id,
      }),
    );
  });

  it('should persist a consistent draft + session, open the multipart and schedule upload.expire', async () => {
    const result = await service.createUpload(user.id, {
      original_filename: 'a.mp4',
      content_type: 'video/mp4',
      size_bytes: 12 * MIB,
    });
    createdKeys.push(`videos/${result.public_id}/`);

    const video = await videoRepository.findOneByOrFail({
      public_id: result.public_id,
    });
    const session = await uploadRepository.findOneByOrFail({
      video_id: video.id,
    });
    expect(video.status).toBe('draft');
    expect(video.processing_status).toBe('uploading');
    expect(video.storage_key).toBe(`videos/${result.public_id}/source`);
    expect(video.size_bytes).toBe(12 * MIB);
    expect(session.state).toBe('active');
    expect(session.upload_id).toBe(result.upload.upload_id);
    expect(session.part_size).toBe(5 * MIB);
    expect(session.part_count).toBe(3);
    expect(session.expires_at.toISOString()).toBe(result.upload.expires_at);

    // sessão existe no storage (lista vazia mas válida)
    await expect(
      storage.listParts(video.storage_key, session.upload_id),
    ).resolves.toEqual([]);

    const jobs = await dataSource.query<
      { singleton_key: string; start_after: Date; state: string }[]
    >(
      `SELECT singleton_key, start_after, state FROM "${QUEUE_SCHEMA}"."job"
       WHERE name = 'upload.expire' AND data->>'videoId' = $1`,
      [video.id],
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0].singleton_key).toBe(`upload:${video.id}`);
    expect(jobs[0].state).toBe('created');
    expect(
      Math.abs(
        new Date(jobs[0].start_after).getTime() - session.expires_at.getTime(),
      ),
    ).toBeLessThan(1000);
  }, 30000);

  it('should create independent drafts and multipart sessions for two uploads of the same user', async () => {
    const first = await service.createUpload(user.id, {
      original_filename: 'a.mp4',
      content_type: 'video/mp4',
      size_bytes: 5 * MIB,
    });
    const second = await service.createUpload(user.id, {
      original_filename: 'b.webm',
      content_type: 'video/webm',
      size_bytes: 6 * MIB,
    });
    createdKeys.push(
      `videos/${first.public_id}/`,
      `videos/${second.public_id}/`,
    );

    expect(first.public_id).not.toBe(second.public_id);
    expect(first.upload.upload_id).not.toBe(second.upload.upload_id);
    expect(second.upload.part_count).toBe(2);
    await expect(videoRepository.count()).resolves.toBe(2);
    await expect(uploadRepository.count()).resolves.toBe(2);
  }, 30000);
  describe('upload session lifecycle (parts → complete / abort)', () => {
    /** Pré-cadastra, pede URLs e envia as partes reais ao RustFS; devolve ids e etags. */
    async function uploadParts(sizeBytes: number, partNumbersToSend: number[]) {
      const created = await service.createUpload(user.id, {
        original_filename: 'a.mp4',
        content_type: 'video/mp4',
        size_bytes: sizeBytes,
      });
      createdKeys.push(`videos/${created.public_id}/`);
      const video = await videoRepository.findOneOrFail({
        where: { public_id: created.public_id },
        relations: ['upload'],
      });
      const presigned = await service.presignParts(video, partNumbersToSend);
      const etags = new Map<number, string>();
      for (const part of presigned.parts) {
        const offset = (part.part_number - 1) * (5 * MIB);
        const size = Math.min(5 * MIB, sizeBytes - offset);
        etags.set(
          part.part_number,
          await putPart(part.url, deterministicBuffer(size, part.part_number)),
        );
      }
      return { video, etags };
    }

    async function videoProcessJobs(videoId: string): Promise<JobRow[]> {
      return dataSource.query<JobRow[]>(
        `SELECT singleton_key, state, retry_limit FROM "${QUEUE_SCHEMA}"."job"
         WHERE name = 'video.process' AND data->>'videoId' = $1`,
        [videoId],
      );
    }

    it('should list the parts accepted by the storage for resume', async () => {
      const { video, etags } = await uploadParts(12 * MIB, [1, 2]);

      const state = await service.getUploadState(video);

      expect(state).toMatchObject({
        state: 'active',
        part_count: 3,
        expected_bytes: 12 * MIB,
      });
      expect(state.uploaded_parts).toEqual([
        { part_number: 1, etag: etags.get(1), size: 5 * MIB },
        { part_number: 2, etag: etags.get(2), size: 5 * MIB },
      ]);
    }, 60000);

    it('should assemble 3 real parts, persist the summed size, complete the session and enqueue video.process once', async () => {
      const { video, etags } = await uploadParts(12 * MIB, [1, 2, 3]);
      const parts = [1, 2, 3].map((n) => ({
        part_number: n,
        etag: etags.get(n)!,
      }));

      const result = await service.completeUpload(video, parts);

      expect(result).toEqual({
        public_id: video.public_id,
        status: 'draft',
        processing_status: 'processing',
        size_bytes: 12 * MIB,
      });
      await expect(storage.headObject(video.storage_key)).resolves.toEqual({
        contentLength: 12 * MIB,
        contentType: 'video/mp4',
      });
      const stored = await videoRepository.findOneByOrFail({ id: video.id });
      expect(stored.processing_status).toBe('processing');
      expect(stored.size_bytes).toBe(12 * MIB);
      const session = await uploadRepository.findOneByOrFail({
        video_id: video.id,
      });
      expect(session.state).toBe('completed');
      expect(session.completed_at).toBeInstanceOf(Date);

      const jobs = await videoProcessJobs(video.id);
      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({
        singleton_key: `video:${video.id}`,
        state: 'created',
        retry_limit: 3,
      });

      // a sessão deixou de ser ativa: novas operações são recusadas
      const reloaded = await videoRepository.findOneOrFail({
        where: { id: video.id },
        relations: ['upload'],
      });
      await expect(service.presignParts(reloaded, [1])).rejects.toMatchObject({
        httpStatus: 409,
      });
    }, 60000);

    it('should keep the session active and enqueue nothing when a part is missing', async () => {
      const { video, etags } = await uploadParts(12 * MIB, [1, 2]);

      await expect(
        service.completeUpload(video, [
          { part_number: 1, etag: etags.get(1)! },
          { part_number: 2, etag: etags.get(2)! },
          { part_number: 3, etag: '"deadbeef"' },
        ]),
      ).rejects.toMatchObject({
        httpStatus: 422,
        errorCode: 'UPLOAD_INCOMPLETE',
      });

      const stored = await videoRepository.findOneByOrFail({ id: video.id });
      expect(stored.processing_status).toBe('uploading');
      const session = await uploadRepository.findOneByOrFail({
        video_id: video.id,
      });
      expect(session.state).toBe('active');
      await expect(videoProcessJobs(video.id)).resolves.toEqual([]);
      await expect(
        storage.listParts(video.storage_key, session.upload_id),
      ).resolves.toHaveLength(2);
    }, 60000);

    it('should abort the multipart and delete the draft with its session', async () => {
      const { video } = await uploadParts(5 * MIB, [1]);
      const uploadId = video.upload!.upload_id;

      await service.abortUpload(video);

      await expect(
        storage.listParts(video.storage_key, uploadId),
      ).resolves.toBeNull();
      await expect(
        videoRepository.findOneBy({ id: video.id }),
      ).resolves.toBeNull();
      await expect(
        uploadRepository.findOneBy({ video_id: video.id }),
      ).resolves.toBeNull();
    }, 60000);
  });
  describe('playback URLs (RustFS real)', () => {
    /** Vídeo `ready` semeado direto no banco com a fixture MP4 no storage (sem worker). */
    async function seedReadyVideo(originalFilename: string): Promise<Video> {
      const created = await service.createUpload(user.id, {
        original_filename: originalFilename,
        content_type: 'video/mp4',
        size_bytes: 1,
      });
      createdKeys.push(
        `videos/${created.public_id}/`,
        `thumbnails/${created.public_id}/`,
      );
      const video = await videoRepository.findOneByOrFail({
        public_id: created.public_id,
      });
      const fixture = await videoFixture('mp4-h264-aac');
      await storage.putObject(video.storage_key, fixture.buffer, 'video/mp4');
      await storage.putObject(
        `thumbnails/${video.public_id}/auto.jpg`,
        Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
        'image/jpeg',
      );
      await videoRepository.update(video.id, {
        processing_status: 'ready',
        size_bytes: fixture.buffer.length,
        thumbnail_key: `thumbnails/${video.public_id}/auto.jpg`,
        processed_at: new Date(),
      });
      return videoRepository.findOneByOrFail({ id: video.id });
    }

    it('should emit a stream_url that the storage serves with Range → 206 and exactly the requested bytes', async () => {
      const video = await seedReadyVideo('meu video.mp4');

      const playback = await service.getPlayback(video);

      const res = await fetch(playback.stream_url, {
        headers: { Range: 'bytes=0-1023' },
      });
      expect(res.status).toBe(206);
      expect(res.headers.get('content-range')).toMatch(/^bytes 0-1023\//);
      expect((await res.arrayBuffer()).byteLength).toBe(1024);
    }, 60000);

    it('should emit a download_url carrying Content-Disposition: attachment with the sanitized filename', async () => {
      const video = await seedReadyVideo('meu "video".mp4');

      const playback = await service.getPlayback(video);

      const res = await fetch(playback.download_url);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toBe(
        'attachment; filename="meu video.mp4"',
      );
      await res.arrayBuffer();
      const thumb = await fetch(playback.thumbnail_url!);
      expect(thumb.status).toBe(200);
      expect(thumb.headers.get('content-type')).toBe('image/jpeg');
    }, 60000);
  });
});
