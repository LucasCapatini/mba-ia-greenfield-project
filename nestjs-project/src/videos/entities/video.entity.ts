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
} from '../videos.constants';
import { VideoUpload } from './video-upload.entity';

// Aggregate editorial do vídeo (phase-03-upload-processing/TD-07, Option B): dois eixos de estado
// independentes — `status` (publicação; só `draft` nesta fase) e `processing_status`
// (uploading → processing → ready | failed) — mais os metadados extraídos pelo worker.
// A sessão multipart transitória vive em `VideoUpload` (1:1).
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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Channel, (channel) => channel.videos)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @OneToOne(() => VideoUpload, (upload) => upload.video)
  upload: VideoUpload | null;
}
