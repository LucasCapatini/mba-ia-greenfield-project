import type { S3Client } from '@aws-sdk/client-s3';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import sharp from 'sharp';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import appConfig from '../config/app.config';
import authConfig from '../config/auth.config';
import databaseConfig from '../config/database.config';
import queueConfig from '../config/queue.config';
import storageConfig from '../config/storage.config';
import uploadConfig from '../config/upload.config';
import { QueueService } from '../queue/queue.service';
import { VideoReactionsService } from '../reactions/video-reactions.service';
import { S3_INTERNAL_CLIENT } from '../storage/storage.constants';
import { StorageService } from '../storage/storage.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
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
import { seedUserWithChannel, seedVideo } from '../test/social-fixtures';
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
            authConfig,
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
  describe('publish / unpublish (Fase 04 — DB real)', () => {
    async function seedDraft(processingStatus: Video['processing_status']) {
      const channel = await dataSource
        .getRepository(Channel)
        .findOneByOrFail({ user_id: user.id });
      return videoRepository.save(
        videoRepository.create({
          public_id: 'pubTest0001',
          channel_id: channel.id,
          title: 'aula',
          original_filename: 'aula.mp4',
          content_type: 'video/mp4',
          size_bytes: MIB,
          storage_key: 'videos/pubTest0001/source',
          processing_status: processingStatus,
        }),
      );
    }

    it('should persist status and write published_at only on the first publication', async () => {
      const video = await seedDraft('ready');

      const first = await service.publish(video);
      const stored = await videoRepository.findOneByOrFail({ id: video.id });
      expect(stored.status).toBe('published');
      expect(stored.published_at).toBeInstanceOf(Date);
      expect(first.published_at).toBe(stored.published_at!.toISOString());

      await service.unpublish(stored);
      const unpublished = await videoRepository.findOneByOrFail({
        id: video.id,
      });
      expect(unpublished.status).toBe('draft');
      expect(unpublished.published_at?.toISOString()).toBe(first.published_at);

      await service.publish(unpublished);
      const republished = await videoRepository.findOneByOrFail({
        id: video.id,
      });
      expect(republished.status).toBe('published');
      expect(republished.published_at?.toISOString()).toBe(first.published_at);
    });

    it('should expose the owning channel on a published video read without the relation loaded', async () => {
      const draft = await seedDraft('ready');
      await service.publish(draft);
      const stored = await videoRepository.findOneByOrFail({ id: draft.id });

      const response = await service.getVideo(stored);

      expect(response.status).toBe('published');
      expect(response.channel).toEqual({
        nickname: 'owner_int',
        name: 'Owner',
        subscriber_count: 0,
        viewer_subscribed: false,
      });
      expect(response.viewer_reaction).toBeNull();
    });

    it('should leave the row untouched when publishing a video still processing', async () => {
      const video = await seedDraft('processing');

      await expect(service.publish(video)).rejects.toMatchObject({
        errorCode: 'VIDEO_NOT_PUBLISHABLE',
      });

      const stored = await videoRepository.findOneByOrFail({ id: video.id });
      expect(stored.status).toBe('draft');
      expect(stored.published_at).toBeNull();
    });
  });
  describe('viewer state (Fase 06 — social-interactions/TD-04)', () => {
    async function publishedWithFan() {
      const owner = await dataSource
        .getRepository(Channel)
        .findOneByOrFail({ user_id: user.id });
      const video = await seedVideo(dataSource, owner);
      const { user: fan } = await seedUserWithChannel(dataSource, 'vs_fan');
      return { owner, video, fan };
    }

    it('should fill viewer_reaction and viewer_subscribed for the viewer who reacted and subscribed', async () => {
      const { owner, video, fan } = await publishedWithFan();
      await module
        .get(VideoReactionsService)
        .set(video.public_id, fan.id, 'like');
      await module.get(SubscriptionsService).subscribe(fan.id, owner.nickname);
      const stored = await videoRepository.findOneByOrFail({ id: video.id });

      const response = await service.getVideo(stored, fan.id);

      expect(response.viewer_reaction).toBe('like');
      expect(response.like_count).toBe(1);
      expect(response.channel).toEqual({
        nickname: owner.nickname,
        name: owner.name,
        subscriber_count: 1,
        viewer_subscribed: true,
      });
    });

    it('should give an anonymous reader null/false with the subscriber_count from channels', async () => {
      const { owner, video, fan } = await publishedWithFan();
      await module.get(SubscriptionsService).subscribe(fan.id, owner.nickname);
      const stored = await videoRepository.findOneByOrFail({ id: video.id });

      const response = await service.getVideo(stored);

      expect(response.viewer_reaction).toBeNull();
      expect(response.channel.subscriber_count).toBe(1);
      expect(response.channel.viewer_subscribed).toBe(false);
    });
  });

  describe('custom thumbnail (Fase 04 — RustFS real)', () => {
    async function seedReadyVideo(publicId: string): Promise<Video> {
      const channel = await dataSource
        .getRepository(Channel)
        .findOneByOrFail({ user_id: user.id });
      const thumbnailKey = `thumbnails/${publicId}/auto.jpg`;
      await storage.putObject(
        thumbnailKey,
        await sharp({
          create: { width: 640, height: 360, channels: 3, background: '#333' },
        })
          .jpeg()
          .toBuffer(),
        'image/jpeg',
      );
      createdKeys.push(`thumbnails/${publicId}/`);
      return videoRepository.save(
        videoRepository.create({
          public_id: publicId,
          channel_id: channel.id,
          title: 'aula',
          original_filename: 'aula.mp4',
          content_type: 'video/mp4',
          size_bytes: MIB,
          storage_key: `videos/${publicId}/source`,
          processing_status: 'ready',
          thumbnail_key: thumbnailKey,
        }),
      );
    }

    it('should store a normalized custom.jpg, record the key and switch thumbnail_url back and forth', async () => {
      const video = await seedReadyVideo('thumbTest01');
      const png = await sharp({
        create: { width: 1920, height: 1080, channels: 3, background: '#c00' },
      })
        .png()
        .toBuffer();

      const withCustom = await service.setCustomThumbnail(video, {
        buffer: png,
        mimetype: 'image/png',
      });

      expect(withCustom.has_custom_thumbnail).toBe(true);
      expect(withCustom.thumbnail_url).toContain(
        '/thumbnails/thumbTest01/custom.jpg?v=',
      );
      const stored = await videoRepository.findOneByOrFail({ id: video.id });
      expect(stored.custom_thumbnail_key).toBe(
        'thumbnails/thumbTest01/custom.jpg',
      );
      const head = await storage.headObject(
        'thumbnails/thumbTest01/custom.jpg',
      );
      expect(head?.contentType).toBe('image/jpeg');
      const object = await fetch(withCustom.thumbnail_url!);
      const metadata = await sharp(
        Buffer.from(await object.arrayBuffer()),
      ).metadata();
      expect([metadata.format, metadata.width, metadata.height]).toEqual([
        'jpeg',
        1280,
        720,
      ]);
      await expect(
        storage.headObject('thumbnails/thumbTest01/auto.jpg'),
      ).resolves.not.toBeNull();

      await service.removeCustomThumbnail(stored);

      const reverted = await videoRepository.findOneByOrFail({ id: video.id });
      expect(reverted.custom_thumbnail_key).toBeNull();
      await expect(
        storage.headObject('thumbnails/thumbTest01/custom.jpg'),
      ).resolves.toBeNull();
      const response = await service.getVideo(reverted);
      expect(response.has_custom_thumbnail).toBe(false);
      expect(response.thumbnail_url).toContain(
        '/thumbnails/thumbTest01/auto.jpg?v=',
      );

      await expect(
        service.removeCustomThumbnail(reverted),
      ).resolves.toBeUndefined();
    });

    it('should not touch the storage or the row when the image is rejected', async () => {
      const video = await seedReadyVideo('thumbTest02');

      await expect(
        service.setCustomThumbnail(video, {
          buffer: Buffer.from('not an image'),
          mimetype: 'image/png',
        }),
      ).rejects.toMatchObject({ errorCode: 'THUMBNAIL_INVALID' });

      const stored = await videoRepository.findOneByOrFail({ id: video.id });
      expect(stored.custom_thumbnail_key).toBeNull();
      await expect(
        storage.headObject('thumbnails/thumbTest02/custom.jpg'),
      ).resolves.toBeNull();
    });
  });
  describe('deleteVideo (Fase 04 — DB + pg-boss + RustFS reais)', () => {
    it('should abort the active multipart, delete the row and its session and enqueue video.delete', async () => {
      const created = await service.createUpload(user.id, {
        original_filename: 'apagar.mp4',
        content_type: 'video/mp4',
        size_bytes: 6 * MIB,
      });
      createdKeys.push(`videos/${created.public_id}/`);
      const video = await videoRepository.findOneOrFail({
        where: { public_id: created.public_id },
        relations: ['upload'],
      });

      await service.deleteVideo(video);

      await expect(
        videoRepository.findOneBy({ id: video.id }),
      ).resolves.toBeNull();
      await expect(
        uploadRepository.findOneBy({ video_id: video.id }),
      ).resolves.toBeNull();
      await expect(
        storage.listParts(video.storage_key, created.upload.upload_id),
      ).resolves.toBeNull();
      const jobs = await dataSource.query<
        { singleton_key: string; data: { thumbnailKeys: string[] } }[]
      >(
        `SELECT singleton_key, data FROM "${QUEUE_SCHEMA}"."job" WHERE name = 'video.delete' AND data->>'videoId' = $1`,
        [video.id],
      );
      expect(jobs).toHaveLength(1);
      expect(jobs[0].singleton_key).toBe(`video-delete:${video.id}`);
      expect(jobs[0].data.thumbnailKeys).toEqual([]);
    });

    it('should roll the deletion back when enqueueing the job fails', async () => {
      const created = await service.createUpload(user.id, {
        original_filename: 'manter.mp4',
        content_type: 'video/mp4',
        size_bytes: MIB,
      });
      createdKeys.push(`videos/${created.public_id}/`);
      await videoRepository.update(
        { public_id: created.public_id },
        { processing_status: 'ready' },
      );
      await uploadRepository.update(
        { upload_id: created.upload.upload_id },
        { state: 'completed' },
      );
      const video = await videoRepository.findOneOrFail({
        where: { public_id: created.public_id },
        relations: ['upload'],
      });
      const queue = module.get(QueueService);
      const send = jest
        .spyOn(queue, 'send')
        .mockRejectedValueOnce(new Error('queue down'));

      await expect(service.deleteVideo(video)).rejects.toThrow('queue down');

      send.mockRestore();
      await expect(
        videoRepository.findOneBy({ id: video.id }),
      ).resolves.not.toBeNull();
      await expect(
        uploadRepository.findOneBy({ video_id: video.id }),
      ).resolves.not.toBeNull();
    });
  });
});
