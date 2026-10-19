import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendVideosForPublishing1792416589954 implements MigrationInterface {
  name = 'ExtendVideosForPublishing1792416589954';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "videos" ADD "title" character varying(100) NOT NULL DEFAULT ''`,
    );
    // Data backfill (hand-written): drafts from Phase 03 get the title the pre-registration now
    // derives — `original_filename` without its last extension, falling back to the whole name
    // when nothing is left (e.g. ".mp4"), truncated to 100 chars. Same rule as `deriveVideoTitle`.
    await queryRunner.query(
      `UPDATE "videos" SET "title" = left(COALESCE(NULLIF(btrim(regexp_replace("original_filename", '\\.[^.]*$', '')), ''), btrim("original_filename")), 100) WHERE "title" = ''`,
    );
    await queryRunner.query(`ALTER TABLE "videos" ADD "description" text`);
    await queryRunner.query(`ALTER TABLE "videos" ADD "category_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "videos" ADD "visibility" character varying(16) NOT NULL DEFAULT 'public'`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD "published_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD "custom_thumbnail_key" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD "view_count" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD "like_count" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD "dislike_count" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD "comment_count" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f9fe0463a9fa4899f41ab73651" ON "videos" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_videos_status_visibility_published" ON "videos" ("status", "visibility", "published_at", "id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_videos_channel_status_published" ON "videos" ("channel_id", "status", "published_at", "id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD CONSTRAINT "FK_f9fe0463a9fa4899f41ab736511" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "videos" DROP CONSTRAINT "FK_f9fe0463a9fa4899f41ab736511"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_videos_channel_status_published"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_videos_status_visibility_published"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f9fe0463a9fa4899f41ab73651"`,
    );
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "comment_count"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "dislike_count"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "like_count"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "view_count"`);
    await queryRunner.query(
      `ALTER TABLE "videos" DROP COLUMN "custom_thumbnail_key"`,
    );
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "published_at"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "visibility"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "category_id"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "title"`);
  }
}
