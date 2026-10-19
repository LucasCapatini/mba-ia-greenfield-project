import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVideosAndVideoUploads1792352807074 implements MigrationInterface {
  name = 'CreateVideosAndVideoUploads1792352807074';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "video_uploads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "video_id" uuid NOT NULL, "upload_id" character varying(255) NOT NULL, "part_size" integer NOT NULL, "part_count" integer NOT NULL, "expected_bytes" bigint NOT NULL, "state" character varying(16) NOT NULL DEFAULT 'active', "expires_at" TIMESTAMP NOT NULL, "completed_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_06a943c51e95702c3e84693180f" UNIQUE ("video_id"), CONSTRAINT "REL_06a943c51e95702c3e84693180" UNIQUE ("video_id"), CONSTRAINT "PK_c3def71eaaba3a49539786ef82a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fad4259ebc77acc143359da9f2" ON "video_uploads" ("state", "expires_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "videos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "public_id" character varying(11) NOT NULL, "channel_id" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'draft', "processing_status" character varying(16) NOT NULL DEFAULT 'uploading', "processing_error" character varying(64), "processing_error_detail" text, "original_filename" character varying(255) NOT NULL, "content_type" character varying(64) NOT NULL, "size_bytes" bigint, "storage_key" character varying(255) NOT NULL, "thumbnail_key" character varying(255), "duration_seconds" numeric(10,3), "width" integer, "height" integer, "container" character varying(32), "video_codec" character varying(32), "audio_codec" character varying(32), "processed_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_39a1f0fe7991162aace659078ec" UNIQUE ("public_id"), CONSTRAINT "PK_e4c86c0cf95aff16e9fb8220f6b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_023a8e4f3f1a34ff3d8ca04a4c" ON "videos" ("channel_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cc84e47e199e109fa2a1c8c4fb" ON "videos" ("processing_status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "video_uploads" ADD CONSTRAINT "FK_06a943c51e95702c3e84693180f" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD CONSTRAINT "FK_023a8e4f3f1a34ff3d8ca04a4cc" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "videos" DROP CONSTRAINT "FK_023a8e4f3f1a34ff3d8ca04a4cc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_uploads" DROP CONSTRAINT "FK_06a943c51e95702c3e84693180f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cc84e47e199e109fa2a1c8c4fb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_023a8e4f3f1a34ff3d8ca04a4c"`,
    );
    await queryRunner.query(`DROP TABLE "videos"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fad4259ebc77acc143359da9f2"`,
    );
    await queryRunner.query(`DROP TABLE "video_uploads"`);
  }
}
