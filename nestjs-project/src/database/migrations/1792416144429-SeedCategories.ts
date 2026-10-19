import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Carga inicial do catálogo de categorias (video-channel-management/TD-01, Revisions
 * 2026-10-18). A lista é literal de propósito: migrations são histórico imutável e não devem
 * depender de constantes que podem mudar depois. `ON CONFLICT DO NOTHING` torna o `up`
 * reexecutável; o `down` remove só estes slugs.
 */
const CATEGORIES: ReadonlyArray<readonly [slug: string, name: string]> = [
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

export class SeedCategories1792416144429 implements MigrationInterface {
  name = 'SeedCategories1792416144429';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const values = CATEGORIES.map(
      (_, index) => `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
    ).join(', ');
    const parameters = CATEGORIES.flatMap(([slug, name], index) => [
      slug,
      name,
      index + 1,
    ]);
    await queryRunner.query(
      `INSERT INTO "categories" ("slug", "name", "sort_order") VALUES ${values} ON CONFLICT ("slug") DO NOTHING`,
      parameters,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "categories" WHERE "slug" = ANY($1::text[])`,
      [CATEGORIES.map(([slug]) => slug)],
    );
  }
}
