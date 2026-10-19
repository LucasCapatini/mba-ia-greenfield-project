import { DataSource } from 'typeorm';
import { SeedCategories1792416144429 } from '../database/migrations/1792416144429-SeedCategories';
import {
  ALL_ENTITIES,
  createTestDataSource,
} from '../test/create-test-data-source';
import { CategoriesService } from './categories.service';

describe('CategoriesService (integration)', () => {
  let dataSource: DataSource;
  let categoriesService: CategoriesService;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    // The seed is idempotent: guarantee the catalog regardless of suite order.
    const queryRunner = dataSource.createQueryRunner();
    try {
      await new SeedCategories1792416144429().up(queryRunner);
    } finally {
      await queryRunner.release();
    }
    categoriesService = new CategoriesService(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('findAll', () => {
    it('returns the catalog ordered by sort_order', async () => {
      const categories = await categoriesService.findAll();

      expect(categories.map((category) => category.slug)).toEqual([
        'music',
        'gaming',
        'education',
        'entertainment',
        'sports',
        'news',
        'technology',
        'travel',
        'cooking',
        'other',
      ]);
      const orders = categories.map((category) => category.sort_order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    });
  });

  describe('findById', () => {
    it('returns the category for an existing id', async () => {
      const [first] = await categoriesService.findAll();

      const found = await categoriesService.findById(first.id);

      expect(found).not.toBeNull();
      expect(found!.slug).toBe('music');
    });

    it('returns null for an unknown id', async () => {
      const found = await categoriesService.findById(
        '00000000-0000-4000-8000-000000000000',
      );

      expect(found).toBeNull();
    });
  });
});
