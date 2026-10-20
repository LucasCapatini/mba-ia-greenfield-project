import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Video } from '../../videos/entities/video.entity';
import {
  REACTION_ENUM_NAME,
  REACTION_VALUES,
  type ReactionValue,
} from '../reactions.constants';

// Reação de um usuário a um vídeo (social-interactions/TD-01, Option A): no máximo uma por
// (usuário, vídeo) — a PK composta é o alvo do `INSERT … ON CONFLICT DO NOTHING`. Os contadores
// `videos.like_count`/`dislike_count` são ajustados na mesma transação (TD-02). Os nomes de
// constraints repetem os da migration CreateSocialInteractions.
@Entity('video_reactions')
@Index('IDX_video_reactions_video_id', ['video_id'])
export class VideoReaction {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_video_reactions',
  })
  user_id: string;

  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_video_reactions',
  })
  video_id: string;

  @Column({ type: 'enum', enum: REACTION_VALUES, enumName: REACTION_ENUM_NAME })
  value: ReactionValue;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_video_reactions_user',
  })
  user: User;

  /** Hard delete do vídeo (video-channel-management/TD-09) leva as reações junto. */
  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'video_id',
    foreignKeyConstraintName: 'FK_video_reactions_video',
  })
  video: Video;
}
