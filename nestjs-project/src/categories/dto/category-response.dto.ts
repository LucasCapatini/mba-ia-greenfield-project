import { ApiProperty } from '@nestjs/swagger';
import type { Category } from '../entities/category.entity';

// Shape público de categoria (`### API Contracts → CategoryResponse`). Anotado para o Swagger
// porque o openapi.json é a fonte dos tipos do frontend (openapi-docs-nestjs/TD-01).
export class CategoryResponse {
  @ApiProperty({
    format: 'uuid',
    example: '6f1c2b0e-4b7a-4c1e-9f62-0d6c8c1f7a10',
  })
  id: string;

  @ApiProperty({
    description: 'Chave estável da categoria, usada em filtros.',
    example: 'technology',
  })
  slug: string;

  @ApiProperty({ description: 'Rótulo de exibição.', example: 'Technology' })
  name: string;

  @ApiProperty({
    type: 'integer',
    description: 'Ordem de exibição (crescente).',
    example: 7,
  })
  sort_order: number;
}

export function toCategoryResponse(category: Category): CategoryResponse {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    sort_order: category.sort_order,
  };
}
