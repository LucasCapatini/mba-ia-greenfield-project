import { DataSource, DataSourceOptions, MigrationInterface } from 'typeorm';
import { ENTITIES } from '../database/entities';

/**
 * Todas as entidades do schema (`src/database/entities.ts`). Como as relações são bidirecionais
 * (ex.: `Channel.videos`), um DataSource de teste que registre `Channel` precisa registrar
 * `Video` também — use esta lista em vez de montar subconjuntos por suíte.
 */
export const ALL_ENTITIES = ENTITIES;

interface TestDataSourceOptions {
  synchronize?: boolean;
  migrations?: (new () => MigrationInterface)[];
}

export function createTestDataSource(
  entities: NonNullable<DataSourceOptions['entities']>,
  options: TestDataSourceOptions = {},
): DataSource {
  const { synchronize = true, migrations } = options;
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'db',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'streamtube',
    password: process.env.DB_PASSWORD ?? 'streamtube',
    database: process.env.DB_DATABASE ?? 'streamtube',
    entities,
    synchronize,
    ...(migrations !== undefined && { migrations, migrationsRun: false }),
  });
}

/**
 * Limpa as tabelas do domínio na ordem das FKs (filhas antes das pais) e os jobs do pg-boss
 * (schema `QUEUE_SCHEMA`, criado pelo próprio pg-boss — fora do TypeORM) quando existirem.
 */
export async function cleanAllTables(dataSource: DataSource): Promise<void> {
  await dataSource.query('DELETE FROM "comment_reactions"');
  await dataSource.query('DELETE FROM "comments"');
  await dataSource.query('DELETE FROM "video_reactions"');
  await dataSource.query('DELETE FROM "subscriptions"');
  await dataSource.query('DELETE FROM "video_views"');
  await dataSource.query('DELETE FROM "video_uploads"');
  await dataSource.query('DELETE FROM "videos"');
  await dataSource.query('DELETE FROM "refresh_tokens"');
  await dataSource.query('DELETE FROM "verification_tokens"');
  await dataSource.query('DELETE FROM "channels"');
  await dataSource.query('DELETE FROM "users"');
  await cleanQueueTables(dataSource);
}

export async function cleanQueueTables(dataSource: DataSource): Promise<void> {
  const schema = process.env.QUEUE_SCHEMA ?? 'pgboss';
  const tables = await dataSource.query<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_name IN ('job', 'archive')`,
    [schema],
  );
  for (const { table_name } of tables) {
    await dataSource.query(`DELETE FROM "${schema}"."${table_name}"`);
  }
}
