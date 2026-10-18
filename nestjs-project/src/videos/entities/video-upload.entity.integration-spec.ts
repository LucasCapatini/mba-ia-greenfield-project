import { DataSource, Repository } from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../../test/create-test-data-source';
import { User } from '../../users/entities/user.entity';
import { generatePublicId, storageKeys } from '../public-id.util';
import { VideoUpload } from './video-upload.entity';
import { Video } from './video.entity';

describe('VideoUpload entity (integration)', () => {
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let uploadRepository: Repository<VideoUpload>;
  let channel: Channel;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    videoRepository = dataSource.getRepository(Video);
    uploadRepository = dataSource.getRepository(VideoUpload);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    const userRepository = dataSource.getRepository(User);
    const channelRepository = dataSource.getRepository(Channel);
    const user = await userRepository.save(
      userRepository.create({
        email: 'upload_user@example.com',
        password: 'hashed',
      }),
    );
    channel = await channelRepository.save(
      channelRepository.create({
        name: 'Chan',
        nickname: 'upload_chan',
        user_id: user.id,
      }),
    );
  });

  async function createVideo(): Promise<Video> {
    const publicId = generatePublicId();
    return videoRepository.save(
      videoRepository.create({
        public_id: publicId,
        channel_id: channel.id,
        original_filename: 'a.mp4',
        content_type: 'video/mp4',
        size_bytes: 12582912,
        storage_key: storageKeys(publicId).source,
      }),
    );
  }

  function session(video: Video): VideoUpload {
    return uploadRepository.create({
      video_id: video.id,
      upload_id: 'upload-abc',
      part_size: 5242880,
      part_count: 3,
      expected_bytes: 12582912,
      expires_at: new Date(Date.now() + 86400_000),
    });
  }

  it('should persist an active session by default with numeric expected_bytes', async () => {
    const video = await createVideo();

    const saved = await uploadRepository.save(session(video));
    const found = await uploadRepository.findOneByOrFail({ id: saved.id });

    expect(found.state).toBe('active');
    expect(found.expected_bytes).toBe(12582912);
    expect(typeof found.expected_bytes).toBe('number');
    expect(found.completed_at).toBeNull();
    expect(found.expires_at).toBeInstanceOf(Date);
  });

  it('should enforce one session per video (unique video_id)', async () => {
    const video = await createVideo();
    await uploadRepository.save(session(video));

    await expect(uploadRepository.save(session(video))).rejects.toThrow();
  });

  it('should require expires_at', async () => {
    const video = await createVideo();
    const upload = session(video);
    (upload as { expires_at: Date | null }).expires_at = null;

    await expect(uploadRepository.save(upload)).rejects.toThrow();
  });

  it('should cascade-delete the session when the video is removed', async () => {
    const video = await createVideo();
    const saved = await uploadRepository.save(session(video));

    await videoRepository.delete({ id: video.id });

    await expect(
      uploadRepository.findOneBy({ id: saved.id }),
    ).resolves.toBeNull();
  });

  it('should be reachable from the video side of the one-to-one relation', async () => {
    const video = await createVideo();
    await uploadRepository.save(session(video));

    const found = await videoRepository.findOne({
      where: { id: video.id },
      relations: ['upload'],
    });

    expect(found?.upload?.upload_id).toBe('upload-abc');
    expect(found?.upload?.part_count).toBe(3);
  });
});
