import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVideoViews1792458459333 implements MigrationInterface {
  name = 'CreateVideoViews1792458459333';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "video_views" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "video_id" uuid NOT NULL, "viewer_key" character varying(80) NOT NULL, "window_start" date NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_video_views_video_viewer_window" UNIQUE ("video_id", "viewer_key", "window_start"), CONSTRAINT "PK_ff495d570215fc8f915a4c8dd08" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_video_views_window_start" ON "video_views" ("window_start") `,
    );
    await queryRunner.query(
      `ALTER TABLE "video_views" ADD CONSTRAINT "FK_a114fa5a00f0f39b72bb551d943" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "video_views" DROP CONSTRAINT "FK_a114fa5a00f0f39b72bb551d943"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_video_views_window_start"`,
    );
    await queryRunner.query(`DROP TABLE "video_views"`);
  }
}
