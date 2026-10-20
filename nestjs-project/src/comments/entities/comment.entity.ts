import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Video } from '../../videos/entities/video.entity';

// Comentário de um vídeo (social-interactions/TD-05, TD-07). Um nível de resposta: `parent_id`
// nulo = raiz; preenchido aponta sempre para uma raiz. `reply_count` só é usado na raiz. Os
// contadores são ajustados na mesma transação dos eventos (TD-02). Os índices parciais servem as
// listagens keyset de raízes (`latest`/`top`, TD-06) e o de `parent_id` a listagem das respostas.
// Os nomes repetem os da migration CreateSocialInteractions.
@Entity('comments')
@Index('IDX_comments_video_latest', ['video_id', 'created_at', 'id'], {
  where: '"parent_id" IS NULL',
})
@Index(
  'IDX_comments_video_top',
  ['video_id', 'like_count', 'created_at', 'id'],
  {
    where: '"parent_id" IS NULL',
  },
)
@Index('IDX_comments_parent', ['parent_id', 'created_at', 'id'])
export class Comment {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_comments' })
  id: string;

  @Column({ type: 'uuid' })
  video_id: string;

  /** Autor; o `author` exposto pela API é o canal deste usuário. */
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid', nullable: true })
  parent_id: string | null;

  /** Texto puro, 1–2.000 caracteres após `trim` (validado no DTO, TD-07). */
  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'integer', default: 0 })
  like_count: number;

  @Column({ type: 'integer', default: 0 })
  dislike_count: number;

  @Column({ type: 'integer', default: 0 })
  reply_count: number;

  @Column({ type: 'timestamp', nullable: true })
  edited_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  /** Hard delete do vídeo leva os comentários (e, por cascata, as respostas e reações). */
  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'video_id',
    foreignKeyConstraintName: 'FK_comments_video',
  })
  video: Video;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_comments_user' })
  user: User;

  /** Excluir a raiz apaga as respostas (exclusão física, TD-07). */
  @ManyToOne(() => Comment, (comment) => comment.replies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'parent_id',
    foreignKeyConstraintName: 'FK_comments_parent',
  })
  parent: Comment | null;

  @OneToMany(() => Comment, (comment) => comment.parent)
  replies: Comment[];
}
