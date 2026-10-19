import { Injectable } from '@nestjs/common';
import { DataSource, type Repository } from 'typeorm';
import { Category } from './entities/category.entity';

// Leitura do catálogo fixo de categorias (video-channel-management/TD-01). Não há escrita pela
// API: as linhas vêm da data migration `SeedCategories`.
@Injectable()
export class CategoriesService {
  constructor(private readonly dataSource: DataSource) {}

  private get repository(): Repository<Category> {
    return this.dataSource.getRepository(Category);
  }

  /** Todas as categorias na ordem de exibição. */
  async findAll(): Promise<Category[]> {
    return this.repository.find({ order: { sort_order: 'ASC', slug: 'ASC' } });
  }

  /** Usado para validar `category_id` na edição de vídeo; `null` quando não existe. */
  async findById(id: string): Promise<Category | null> {
    return this.repository.findOneBy({ id });
  }
}
