import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../../test/create-test-data-source';
import { User } from '../../users/entities/user.entity';
import { generatePublicId, storageKeys } from '../public-id.util';
import { VideoView } from './video-view.entity';
import { Video } from './video.entity';

describe('VideoView entity (integration)', () => {
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let viewRepository: Repository<VideoView>;
  let channel: Channel;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    videoRepository = dataSource.getRepository(Video);
    viewRepository = dataSource.getRepository(VideoView);
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
        email: 'views_user@example.com',
        password: 'hashed',
      }),
    );
    channel = await channelRepository.save(
      channelRepository.create({
        name: 'Views',
        nickname: 'views_chan',
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
        size_bytes: 1024,
        storage_key: storageKeys(publicId).source,
      }),
    );
  }

  function view(video: Video, viewerKey: string, day: string): VideoView {
    return viewRepository.create({
      video_id: video.id,
      viewer_key: viewerKey,
      window_start: day,
    });
  }

  it('should persist a view with the UTC day as a YYYY-MM-DD string and a creation timestamp', async () => {
    const video = await createVideo();

    const saved = await viewRepository.save(
      view(video, 'user:11111111-1111-4111-8111-111111111111', '2026-10-19'),
    );
    const found = await viewRepository.findOneByOrFail({ id: saved.id });

    expect(found.window_start).toBe('2026-10-19');
    expect(found.created_at).toBeInstanceOf(Date);
  });

  it('should reject a second view of the same viewer on the same video and day', async () => {
    const video = await createVideo();
    await viewRepository.save(view(video, 'anon:abc', '2026-10-19'));

    await expect(
      viewRepository.save(view(video, 'anon:abc', '2026-10-19')),
    ).rejects.toBeInstanceOf(QueryFailedError);
  });

  it('should accept the same viewer on another day or another video', async () => {
    const video = await createVideo();
    const other = await createVideo();
    await viewRepository.save(view(video, 'anon:abc', '2026-10-19'));

    await viewRepository.save(view(video, 'anon:abc', '2026-10-20'));
    await viewRepository.save(view(other, 'anon:abc', '2026-10-19'));

    expect(await viewRepository.count()).toBe(3);
  });

  it('should delete the views of a video when the video is deleted', async () => {
    const video = await createVideo();
    const other = await createVideo();
    await viewRepository.save(view(video, 'anon:abc', '2026-10-19'));
    await viewRepository.save(view(video, 'anon:def', '2026-10-19'));
    await viewRepository.save(view(other, 'anon:abc', '2026-10-19'));

    await videoRepository.delete({ id: video.id });

    expect(await viewRepository.countBy({ video_id: video.id })).toBe(0);
    expect(await viewRepository.countBy({ video_id: other.id })).toBe(1);
  });
});
