import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Video } from '../../videos/entities/video.entity';

@Entity('channels')
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  nickname: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Contador denormalizado de `subscriptions`, ajustado na transação da inscrição (social-interactions/TD-02). */
  @Column({ type: 'integer', default: 0 })
  subscriber_count: number;

  @Column({ type: 'uuid', unique: true })
  user_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => User, (user) => user.channel)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** Lado inverso de `Video.channel` (Fase 03); carregar explicitamente quando necessário. */
  @OneToMany(() => Video, (video) => video.channel)
  videos: Video[];
}
