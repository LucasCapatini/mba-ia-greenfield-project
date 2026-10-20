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
import { Comment } from '../../comments/entities/comment.entity';
import { User } from '../../users/entities/user.entity';
import {
  REACTION_ENUM_NAME,
  REACTION_VALUES,
  type ReactionValue,
} from '../reactions.constants';

// Reação de um usuário a um comentário ou resposta (social-interactions/TD-01, Option A): no
// máximo uma por (usuário, comentário). `comments.like_count`/`dislike_count` são ajustados na
// mesma transação (TD-02). Os nomes repetem os da migration CreateSocialInteractions.
@Entity('comment_reactions')
@Index('IDX_comment_reactions_comment_id', ['comment_id'])
export class CommentReaction {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_comment_reactions',
  })
  user_id: string;

  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_comment_reactions',
  })
  comment_id: string;

  @Column({ type: 'enum', enum: REACTION_VALUES, enumName: REACTION_ENUM_NAME })
  value: ReactionValue;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_comment_reactions_user',
  })
  user: User;

  /** Excluir o comentário (ou a raiz dele) leva as reações. */
  @ManyToOne(() => Comment, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'comment_id',
    foreignKeyConstraintName: 'FK_comment_reactions_comment',
  })
  comment: Comment;
}
