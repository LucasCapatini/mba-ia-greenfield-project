import { DataSource } from 'typeorm';
import {
  ALL_ENTITIES,
  createTestDataSource,
} from '../test/create-test-data-source';
import { CreateUsersAndChannels1775687773260 } from './migrations/1775687773260-CreateUsersAndChannels';
import { CreateAuthTokens1777579850478 } from './migrations/1777579850478-CreateAuthTokens';
import { CreateVideosAndVideoUploads1792352807074 } from './migrations/1792352807074-CreateVideosAndVideoUploads';

const MANAGED_TABLES = [
  'users',
  'channels',
  'refresh_tokens',
  'verification_tokens',
  'videos',
  'video_uploads',
];

const MIGRATIONS = [
  CreateUsersAndChannels1775687773260,
  CreateAuthTokens1777579850478,
  CreateVideosAndVideoUploads1792352807074,
];

describe('Database migrations (integration)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES, {
      synchronize: false,
      migrations: MIGRATIONS,
    });

    await dataSource.initialize();

    // One statement, one connection: concurrent DROP ... CASCADE calls (Promise.all
    // across pool connections) acquire FK-dependent locks in different orders and
    // intermittently fail with "deadlock detected" in the full --runInBand run.
    const tables = [...MANAGED_TABLES, 'migrations']
      .map((table) => `"${table}"`)
      .join(', ');
    await dataSource.query(`DROP TABLE IF EXISTS ${tables} CASCADE`);
    // Enum types survive DROP TABLE; without this the second migration's
    // CREATE TYPE fails on any DB where migrations already ran once.
    await dataSource.query(
      `DROP TYPE IF EXISTS "public"."verification_tokens_type_enum"`,
    );
  });

  afterAll(async () => {
    // The revert test undoes the last migration, leaving the video tables missing.
    // Re-apply so the shared DB is fully migrated when subsequent suites run.
    await dataSource.runMigrations();
    await dataSource.destroy();
  });

  it('should apply all migrations and create every managed table', async () => {
    const ranMigrations = await dataSource.runMigrations();

    expect(ranMigrations).toHaveLength(MIGRATIONS.length);

    const result = await dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [MANAGED_TABLES],
    );
    const tableNames = result.map((r) => r.table_name);
    expect(tableNames).toEqual([...MANAGED_TABLES].sort());
  });

  it('should create the video indexes and the cascading one-to-one FK', async () => {
    const indexes = await dataSource.query<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('videos', 'video_uploads')`,
    );
    const definitions = indexes.map((row) => row.indexdef);

    expect(
      definitions.some((d) => /UNIQUE.*videos.*\(public_id\)/.test(d)),
    ).toBe(true);
    expect(definitions.some((d) => /videos.*\(channel_id\)/.test(d))).toBe(
      true,
    );
    expect(
      definitions.some((d) => /videos.*\(processing_status\)/.test(d)),
    ).toBe(true);
    expect(
      definitions.some((d) => /UNIQUE.*video_uploads.*\(video_id\)/.test(d)),
    ).toBe(true);
    expect(
      definitions.some((d) => /video_uploads.*\(state, expires_at\)/.test(d)),
    ).toBe(true);

    const fks = await dataSource.query<{ delete_rule: string }[]>(
      `SELECT rc.delete_rule
       FROM information_schema.referential_constraints rc
       JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name
       WHERE tc.table_name = 'video_uploads'`,
    );
    expect(fks.map((row) => row.delete_rule)).toEqual(['CASCADE']);
  });

  it('should revert the last migration and remove the video tables', async () => {
    await dataSource.undoLastMigration();

    const result = await dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [['videos', 'video_uploads']],
    );
    expect(result).toHaveLength(0);
  });
});
