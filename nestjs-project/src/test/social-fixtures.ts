import type { DataSource } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import { Comment } from '../comments/entities/comment.entity';
import { User } from '../users/entities/user.entity';
import { Video } from '../videos/entities/video.entity';
import { generatePublicId, storageKeys } from '../videos/public-id.util';

/**
 * Semeadura mínima para os testes de integração da Fase 06 (reações, comentários, inscrições):
 * usuário + canal e vídeo publicado direto pelos repositórios, sem passar pelos serviços.
 */
let counter = 0;

/**
 * `prefix` gera nickname/e-mail únicos (`{prefix}_{n}`); `exact.nickname`/`exact.name` fixam os
 * valores quando o cenário cita o canal pelo nome (ex.: `criador`).
 */
export async function seedUserWithChannel(
  dataSource: DataSource,
  prefix = 'social',
  exact: { nickname?: string; name?: string } = {},
): Promise<{ user: User; channel: Channel }> {
  counter++;
  const users = dataSource.getRepository(User);
  const channels = dataSource.getRepository(Channel);
  const handle = exact.nickname ?? `${prefix}_${counter}`;
  const user = await users.save(
    users.create({
      email: `${handle}@example.com`,
      password: 'hashed',
    }),
  );
  const channel = await channels.save(
    channels.create({
      name: exact.name ?? `${prefix} channel ${counter}`,
      nickname: handle,
      user_id: user.id,
    }),
  );
  return { user, channel };
}

export async function seedVideo(
  dataSource: DataSource,
  channel: Channel,
  overrides: Partial<Video> = {},
): Promise<Video> {
  const videos = dataSource.getRepository(Video);
  const publicId = generatePublicId();
  return videos.save(
    videos.create({
      public_id: publicId,
      channel_id: channel.id,
      original_filename: 'a.mp4',
      content_type: 'video/mp4',
      size_bytes: 1024,
      storage_key: storageKeys(publicId).source,
      title: `Video ${publicId}`,
      status: 'published',
      visibility: 'public',
      processing_status: 'ready',
      published_at: new Date(),
      ...overrides,
    }),
  );
}

/**
 * Comentário direto pelo repositório, sem mexer nos contadores do vídeo/raiz — para cenários que
 * precisam de muitos itens ou de `like_count` controlado (listagens keyset).
 */
export async function seedComment(
  dataSource: DataSource,
  video: Pick<Video, 'id'>,
  user: Pick<User, 'id'>,
  overrides: Partial<Comment> = {},
): Promise<Comment> {
  const comments = dataSource.getRepository(Comment);
  return comments.save(
    comments.create({
      video_id: video.id,
      user_id: user.id,
      text: 'Comentário',
      ...overrides,
    }),
  );
}
