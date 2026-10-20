import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { Channel } from '../../channels/entities/channel.entity';
import {
  bigintTransformer,
  numericTransformer,
} from '../../common/typeorm/column-transformers';
import type { VideoContainer } from '../video-formats';
import type {
  VideoProcessingError,
  VideoProcessingStatus,
  VideoStatus,
  VideoVisibility,
} from '../videos.constants';
import { VideoUpload } from './video-upload.entity';

// Aggregate editorial do vídeo (phase-03-videos/TD-07, Option B): dois eixos de estado
// independentes — `status` (publicação: draft → published, video-channel-management/TD-02) e
// `processing_status` (uploading → processing → ready | failed) — mais os metadados extraídos
// pelo worker, os campos editoriais (título, descrição, categoria, visibilidade, thumbnail
// customizada — TD-02/TD-04) e os contadores denormalizados (TD-05).
// A sessão multipart transitória vive em `VideoUpload` (1:1).
// Os índices compostos servem as listagens keyset (TD-06); o Postgres percorre o B-tree ao
// contrário, então a ordem `published_at DESC, id DESC` usa o mesmo índice ascendente.
@Index('IDX_videos_channel_status_published', [
  'channel_id',
  'status',
  'published_at',
  'id',
])
@Index('IDX_videos_status_visibility_published', [
  'status',
  'visibility',
  'published_at',
  'id',
])
@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 11 chars URL-safe gerados no pré-cadastro (TD-08); chave da URL pública e prefixo no storage. */
  @Column({ type: 'varchar', length: 11, unique: true })
  public_id: string;

  @Index()
  @Column({ type: 'uuid' })
  channel_id: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: VideoStatus;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'uploading' })
  processing_status: VideoProcessingStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  processing_error: VideoProcessingError | null;

  @Column({ type: 'text', nullable: true })
  processing_error_detail: string | null;

  @Column({ type: 'varchar', length: 255 })
  original_filename: string;

  @Column({ type: 'varchar', length: 64 })
  content_type: string;

  /** Declarado no pré-cadastro; confirmado no `complete` pela soma das partes (TD-03). */
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  size_bytes: number | null;

  /** `videos/{public_id}/source` */
  @Column({ type: 'varchar', length: 255 })
  storage_key: string;

  /** `thumbnails/{public_id}/auto.jpg`, preenchido pelo worker (TD-06). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  thumbnail_key: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 3,
    nullable: true,
    transformer: numericTransformer,
  })
  duration_seconds: number | null;

  @Column({ type: 'integer', nullable: true })
  width: number | null;

  @Column({ type: 'integer', nullable: true })
  height: number | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  container: VideoContainer | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  video_codec: string | null;

  /** `null` quando o vídeo não tem trilha de áudio. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  audio_codec: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processed_at: Date | null;

  /**
   * Preenchido no pré-cadastro com `original_filename` sem extensão (máx. 100). O default `''`
   * só existe para a migration adicionar a coluna a linhas antigas (que são preenchidas no
   * backfill); publicar exige título não vazio (TD-02).
   */
  @Column({ type: 'varchar', length: 100, default: '' })
  title: string;

  /** Máx. 5000 chars (validação no DTO de edição). */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  category_id: string | null;

  /** Só tem efeito quando `status = published`; editável a qualquer momento (TD-02). */
  @Column({ type: 'varchar', length: 16, default: 'public' })
  visibility: VideoVisibility;

  /** Gravado na primeira publicação; não é anulado ao despublicar (TD-02). */
  @Column({ type: 'timestamp', nullable: true })
  published_at: Date | null;

  /** `thumbnails/{public_id}/custom.jpg` (TD-04); `thumbnail_key` (automática) fica intacta. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  custom_thumbnail_key: string | null;

  /** Contadores denormalizados (TD-05): views na Fase 05, likes/dislikes/comentários na Fase 06. */
  @Column({ type: 'integer', default: 0 })
  view_count: number;

  @Column({ type: 'integer', default: 0 })
  like_count: number;

  @Column({ type: 'integer', default: 0 })
  dislike_count: number;

  @Column({ type: 'integer', default: 0 })
  comment_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Channel, (channel) => channel.videos)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  /** Apagar a categoria deixa o vídeo sem categoria em vez de falhar. */
  @ManyToOne(() => Category, (category) => category.videos, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @OneToOne(() => VideoUpload, (upload) => upload.video)
  upload: VideoUpload | null;
}
