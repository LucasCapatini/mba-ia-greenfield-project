import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CategoriesService } from './categories.service';
import {
  CategoryResponse,
  toCategoryResponse,
} from './dto/category-response.dto';

// Catálogo público (Authorization Matrix: anônimo) — base da edição de vídeo, das sugestões
// (Fase 05) e do filtro da home (Fase 07).
@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Listar categorias',
    description:
      'Devolve o catálogo fixo de categorias ordenado por `sort_order`. Não exige autenticação.',
  })
  @ApiResponse({
    status: 200,
    description: 'Categorias em ordem de exibição',
    type: CategoryResponse,
    isArray: true,
  })
  async findAll(): Promise<CategoryResponse[]> {
    const categories = await this.categoriesService.findAll();
    return categories.map(toCategoryResponse);
  }
}
