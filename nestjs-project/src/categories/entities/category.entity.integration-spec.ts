import { DataSource, Repository } from 'typeorm';
import { SeedCategories1792416144429 } from '../../database/migrations/1792416144429-SeedCategories';
import {
  ALL_ENTITIES,
  createTestDataSource,
} from '../../test/create-test-data-source';
import { Category } from './category.entity';

const EXPECTED_SEED = [
  ['music', 'Music'],
  ['gaming', 'Gaming'],
  ['education', 'Education'],
  ['entertainment', 'Entertainment'],
  ['sports', 'Sports'],
  ['news', 'News'],
  ['technology', 'Technology'],
  ['travel', 'Travel'],
  ['cooking', 'Cooking'],
  ['other', 'Other'],
];

describe('Category entity + SeedCategories migration (integration)', () => {
  let dataSource: DataSource;
  let repository: Repository<Category>;
  const seed = new SeedCategories1792416144429();

  async function runSeed(direction: 'up' | 'down'): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();
    try {
      await seed[direction](queryRunner);
    } finally {
      await queryRunner.release();
    }
  }

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    repository = dataSource.getRepository(Category);
  });

  afterEach(async () => {
    // Rows created by a test (outside the seed) never leak into other suites.
    await dataSource.query(
      `DELETE FROM "categories" WHERE "slug" LIKE 'test-%'`,
    );
  });

  afterAll(async () => {
    // The catalog is shared reference data: leave it seeded for the next suites.
    await runSeed('up');
    await dataSource.destroy();
  });

  it('seeds the 10 categories in display order (music = 1, other = 10)', async () => {
    await runSeed('down');
    await runSeed('up');

    const rows = await repository.find({ order: { sort_order: 'ASC' } });

    expect(rows.map((row) => [row.slug, row.name])).toEqual(EXPECTED_SEED);
    expect(rows.map((row) => row.sort_order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(rows.find((row) => row.slug === 'music')?.sort_order).toBe(1);
    expect(rows.find((row) => row.slug === 'other')?.sort_order).toBe(10);
  });

  it('keeps the seed idempotent when run twice', async () => {
    await runSeed('up');
    await runSeed('up');

    const [{ count }] = await dataSource.query<{ count: string }[]>(
      `SELECT count(*) FROM "categories" WHERE "slug" = ANY($1::text[])`,
      [EXPECTED_SEED.map(([slug]) => slug)],
    );
    expect(Number(count)).toBe(10);
  });

  it('rejects a second category with an existing slug', async () => {
    await runSeed('up');

    await expect(
      repository.save(
        repository.create({ slug: 'music', name: 'Music 2', sort_order: 99 }),
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it('accepts a new slug and fills the timestamps', async () => {
    const saved = await repository.save(
      repository.create({
        slug: 'test-podcasts',
        name: 'Podcasts',
        sort_order: 11,
      }),
    );

    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.created_at).toBeInstanceOf(Date);
    expect(saved.updated_at).toBeInstanceOf(Date);
  });

  it('removes the seeded rows on down and leaves other rows alone', async () => {
    await runSeed('up');
    await repository.save(
      repository.create({ slug: 'test-keep', name: 'Keep', sort_order: 50 }),
    );

    await runSeed('down');

    const remaining = await repository.find();
    expect(remaining.map((row) => row.slug)).toEqual(['test-keep']);
  });
});
