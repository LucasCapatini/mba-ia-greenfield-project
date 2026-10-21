import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 07 — busca textual da home (home-search-production/TD-03): extensões `pg_trgm` e
 * `unaccent` (ambas "trusted" no PostgreSQL 17), a função `immutable_unaccent` — o `unaccent`
 * nativo é só STABLE, e índice de expressão exige IMMUTABLE — e os índices GIN de trigramas sobre
 * o título do vídeo e o nome/nickname do canal. `GET /videos?q=` casa
 * `immutable_unaccent(lower(coluna)) LIKE '%termo%'`, a mesma expressão dos índices.
 */
export class AddVideoSearch1792518960632 implements MigrationInterface {
  name = 'AddVideoSearch1792518960632';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    // Dicionário qualificado: o resultado não depende do search_path, o que torna o IMMUTABLE honesto.
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION public.immutable_unaccent(text) RETURNS text
       LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
       AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_videos_title_trgm" ON "videos" USING gin (public.immutable_unaccent(lower("title")) gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_channels_name_trgm" ON "channels" USING gin (public.immutable_unaccent(lower("name")) gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_channels_nickname_trgm" ON "channels" USING gin (public.immutable_unaccent(lower("nickname")) gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_channels_nickname_trgm"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_channels_name_trgm"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_videos_title_trgm"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS public.immutable_unaccent(text)`,
    );
    await queryRunner.query(`DROP EXTENSION IF EXISTS unaccent`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS pg_trgm`);
  }
}
