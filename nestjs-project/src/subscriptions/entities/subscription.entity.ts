import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import { User } from '../../users/entities/user.entity';

// Inscrição de um usuário num canal (social-interactions/TD-03, TD-08): no máximo uma por
// (usuário, canal). `channels.subscriber_count` é ajustado na mesma transação (TD-02); a regra
// "não se inscrever no próprio canal" vive no serviço. Os nomes repetem os da migration
// CreateSocialInteractions.
@Entity('subscriptions')
@Index('IDX_subscriptions_channel_id', ['channel_id'])
export class Subscription {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_subscriptions' })
  user_id: string;

  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_subscriptions' })
  channel_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_subscriptions_user',
  })
  user: User;

  @ManyToOne(() => Channel, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'channel_id',
    foreignKeyConstraintName: 'FK_subscriptions_channel',
  })
  channel: Channel;
}
