import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Video } from './video.entity';

// Registro de deduplicação das visualizações (watch-page/TD-02, Revisions 2026-10-19): uma linha
// por (vídeo, espectador, dia UTC). Existe só para decidir se `videos.view_count` deve ser
// incrementado — a exibição continua lendo o contador denormalizado. Linhas com `window_start`
// anterior a 2 dias são apagadas pelo job diário `video-views.cleanup`.
@Entity('video_views')
@Unique('UQ_video_views_video_viewer_window', [
  'video_id',
  'viewer_key',
  'window_start',
])
@Index('IDX_video_views_window_start', ['window_start'])
export class VideoView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  video_id: string;

  /** `user:{user.id}` (autenticado) ou `anon:{sha256 hex}` (salt diário + IP real + User-Agent). */
  @Column({ type: 'varchar', length: 80 })
  viewer_key: string;

  /** Data UTC da visualização (`YYYY-MM-DD`) — o balde da deduplicação. */
  @Column({ type: 'date' })
  window_start: string;

  @CreateDateColumn()
  created_at: Date;

  /** Hard delete do vídeo (video-channel-management/TD-09) leva as views junto. */
  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video: Video;
}
