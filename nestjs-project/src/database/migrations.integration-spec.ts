import { DataSource } from 'typeorm';
import {
  ALL_ENTITIES,
  createTestDataSource,
} from '../test/create-test-data-source';
import { CreateUsersAndChannels1775687773260 } from './migrations/1775687773260-CreateUsersAndChannels';
import { CreateAuthTokens1777579850478 } from './migrations/1777579850478-CreateAuthTokens';
import { CreateVideosAndVideoUploads1792352807074 } from './migrations/1792352807074-CreateVideosAndVideoUploads';
import { CreateCategories1792416126626 } from './migrations/1792416126626-CreateCategories';
import { SeedCategories1792416144429 } from './migrations/1792416144429-SeedCategories';
import { ExtendVideosForPublishing1792416589954 } from './migrations/1792416589954-ExtendVideosForPublishing';
import { CreateVideoViews1792458459333 } from './migrations/1792458459333-CreateVideoViews';

const PUBLISHING_COLUMNS = [
  'title',
  'description',
  'category_id',
  'visibility',
  'published_at',
  'custom_thumbnail_key',
  'view_count',
  'like_count',
  'dislike_count',
  'comment_count',
];

const MANAGED_TABLES = [
  'users',
  'channels',
  'refresh_tokens',
  'verification_tokens',
  'videos',
  'video_uploads',
  'categories',
  'video_views',
];

const MIGRATIONS = [
  CreateUsersAndChannels1775687773260,
  CreateAuthTokens1777579850478,
  CreateVideosAndVideoUploads1792352807074,
  CreateCategories1792416126626,
  SeedCategories1792416144429,
  ExtendVideosForPublishing1792416589954,
  CreateVideoViews1792458459333,
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

  it('should seed the 10 categories with the unique slug index', async () => {
    const rows = await dataSource.query<{ slug: string; sort_order: number }[]>(
      `SELECT slug, sort_order FROM "categories" ORDER BY sort_order`,
    );
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ slug: 'music', sort_order: 1 });
    expect(rows[9]).toEqual({ slug: 'other', sort_order: 10 });

    const indexes = await dataSource.query<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'categories'`,
    );
    expect(
      indexes.some((row) => /UNIQUE.*categories.*\(slug\)/.test(row.indexdef)),
    ).toBe(true);
  });

  it('should add the publishing columns, the keyset indexes and the SET NULL category FK', async () => {
    const columns = await dataSource.query<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = ANY($1::text[])`,
      [PUBLISHING_COLUMNS],
    );
    expect(columns.map((c) => c.column_name).sort()).toEqual(
      [...PUBLISHING_COLUMNS].sort(),
    );

    const indexes = await dataSource.query<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'videos'`,
    );
    const definitions = indexes.map((row) => row.indexdef);
    expect(
      definitions.some((d) =>
        /\(channel_id, status, published_at, id\)/.test(d),
      ),
    ).toBe(true);
    expect(
      definitions.some((d) =>
        /\(status, visibility, published_at, id\)/.test(d),
      ),
    ).toBe(true);
    expect(definitions.some((d) => /videos.*\(category_id\)/.test(d))).toBe(
      true,
    );

    const fks = await dataSource.query<{ delete_rule: string }[]>(
      `SELECT rc.delete_rule
       FROM information_schema.referential_constraints rc
       JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = rc.constraint_name
       WHERE kcu.table_name = 'videos' AND kcu.column_name = 'category_id'`,
    );
    expect(fks.map((row) => row.delete_rule)).toEqual(['SET NULL']);
  });

  /**
   * Undoes migrations from the top down to (and including) `name`, whatever was added after it —
   * `runMigrations()` re-applies them all afterwards.
   */
  async function undoThrough(name: string): Promise<void> {
    for (;;) {
      const [last] = await dataSource.query<{ name: string }[]>(
        `SELECT "name" FROM "migrations" ORDER BY "id" DESC LIMIT 1`,
      );
      await dataSource.undoLastMigration();
      if (!last || last.name === name) return;
    }
  }

  it('should backfill the title of Phase 03 videos when the publishing migration runs', async () => {
    // Simulate a database still at Phase 03: drop the publishing columns, insert drafts, re-run.
    await undoThrough('ExtendVideosForPublishing1792416589954');
    const [{ id: userId }] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO "users" ("email", "password") VALUES ('backfill@example.com', 'x') RETURNING "id"`,
    );
    const [{ id: channelId }] = await dataSource.query<{ id: string }[]>(
      `INSERT INTO "channels" ("name", "nickname", "user_id") VALUES ('Backfill', 'backfill_chan', $1) RETURNING "id"`,
      [userId],
    );
    const filenames = [
      'Minha aula.final.mp4',
      '.mp4',
      'no-extension',
      `${'y'.repeat(150)}.webm`,
    ];
    for (const [index, filename] of filenames.entries()) {
      await dataSource.query(
        `INSERT INTO "videos" ("public_id", "channel_id", "original_filename", "content_type", "storage_key")
         VALUES ($1, $2, $3, 'video/mp4', $4)`,
        [
          `backfill_0${index}`,
          channelId,
          filename,
          `videos/backfill_0${index}/source`,
        ],
      );
    }

    await dataSource.runMigrations();

    const rows = await dataSource.query<
      {
        original_filename: string;
        title: string;
        visibility: string;
        view_count: number;
      }[]
    >(
      `SELECT "original_filename", "title", "visibility", "view_count" FROM "videos"
       WHERE "channel_id" = $1 ORDER BY "public_id"`,
      [channelId],
    );
    expect(rows.map((row) => row.title)).toEqual([
      'Minha aula.final',
      '.mp4',
      'no-extension',
      'y'.repeat(100),
    ]);
    expect(rows.every((row) => row.title.length > 0)).toBe(true);
    expect(rows.every((row) => row.visibility === 'public')).toBe(true);
    expect(rows.every((row) => Number(row.view_count) === 0)).toBe(true);

    await dataSource.query(`DELETE FROM "videos" WHERE "channel_id" = $1`, [
      channelId,
    ]);
    await dataSource.query(`DELETE FROM "channels" WHERE "id" = $1`, [
      channelId,
    ]);
    await dataSource.query(`DELETE FROM "users" WHERE "id" = $1`, [userId]);
  });

  it('should create video_views with the dedup unique key, the window_start index and a cascading FK', async () => {
    const indexes = await dataSource.query<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'video_views'`,
    );
    const definitions = indexes.map((row) => row.indexdef);

    expect(
      definitions.some((d) =>
        /UNIQUE.*video_views.*(video_id, viewer_key, window_start)/.test(d),
      ),
    ).toBe(true);
    expect(definitions.some((d) => /video_views.*(window_start)/.test(d))).toBe(
      true,
    );

    const fks = await dataSource.query<{ delete_rule: string }[]>(
      `SELECT rc.delete_rule
       FROM information_schema.referential_constraints rc
       JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name
       WHERE tc.table_name = 'video_views'`,
    );
    expect(fks.map((row) => row.delete_rule)).toEqual(['CASCADE']);
  });

  it('should revert the video views migration and drop its table', async () => {
    await dataSource.undoLastMigration();

    const result = await dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'video_views'`,
    );
    expect(result).toHaveLength(0);
  });

  it('should revert the publishing migration and drop its columns', async () => {
    await dataSource.undoLastMigration();

    const columns = await dataSource.query<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = ANY($1::text[])`,
      [PUBLISHING_COLUMNS],
    );
    expect(columns).toHaveLength(0);
  });

  it('should revert the seed and then the categories table', async () => {
    await dataSource.undoLastMigration();
    const [{ count }] = await dataSource.query<{ count: string }[]>(
      `SELECT count(*) FROM "categories"`,
    );
    expect(Number(count)).toBe(0);

    await dataSource.undoLastMigration();
    const result = await dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'categories'`,
    );
    expect(result).toHaveLength(0);
  });

  it('should revert the video migration and remove the video tables', async () => {
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
