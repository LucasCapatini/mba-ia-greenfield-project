import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Video } from '../../videos/entities/video.entity';

/**
 * Catálogo fixo de categorias (video-channel-management/TD-01). As linhas nascem da data
 * migration `SeedCategories`; `slug` é a chave estável usada em filtros e na seed, `name` é
 * só rótulo de exibição.
 */
@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'smallint' })
  sort_order: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  /** Lado inverso de `Video.category`; carregar explicitamente quando necessário. */
  @OneToMany(() => Video, (video) => video.category)
  videos: Video[];
}
