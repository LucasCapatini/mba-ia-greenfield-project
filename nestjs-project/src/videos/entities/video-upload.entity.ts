import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintTransformer } from '../../common/typeorm/column-transformers';
import type { VideoUploadState } from '../videos.constants';
import { Video } from './video.entity';

// Sessão multipart transitória 1:1 com o vídeo (phase-03-upload-processing/TD-07, TD-03, TD-12).
// Nasce `active` no pré-cadastro e termina `completed` (complete), `aborted` (DELETE) ou
// `expired` (job upload.expire). Retomada (ListParts) e limpeza operam só sobre `active`.
@Entity('video_uploads')
@Index(['state', 'expires_at'])
export class VideoUpload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  video_id: string;

  /** `UploadId` devolvido por `CreateMultipartUpload`. */
  @Column({ type: 'varchar', length: 255 })
  upload_id: string;

  /** Bytes por parte (= UPLOAD_PART_SIZE no momento do pré-cadastro). */
  @Column({ type: 'integer' })
  part_size: number;

  /** `ceil(expected_bytes / part_size)`, ≤ 10 000 (limite S3). */
  @Column({ type: 'integer' })
  part_count: number;

  /** `size_bytes` declarado no pré-cadastro, ≤ UPLOAD_MAX_BYTES. */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  expected_bytes: number;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  state: VideoUploadState;

  /** `created_at + UPLOAD_TTL` — prazo do job upload.expire. */
  @Column({ type: 'timestamp' })
  expires_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => Video, (video) => video.upload, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video: Video;
}
