import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 06 — interações sociais (social-interactions/TD-01, TD-02, TD-05): enum `reaction_value`,
 * `video_reactions`, `comments` (um nível de resposta via `parent_id`), `comment_reactions`,
 * `subscriptions` e o contador `channels.subscriber_count`. Os nomes de constraints e índices são
 * explícitos e repetidos nas entidades, para `migration:generate` não acusar diferença.
 */
export class CreateSocialInteractions1792472801299 implements MigrationInterface {
  name = 'CreateSocialInteractions1792472801299';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."reaction_value" AS ENUM('like', 'dislike')`,
    );

    await queryRunner.query(
      `CREATE TABLE "video_reactions" ("user_id" uuid NOT NULL, "video_id" uuid NOT NULL, "value" "public"."reaction_value" NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_video_reactions" PRIMARY KEY ("user_id", "video_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_video_reactions_video_id" ON "video_reactions" ("video_id") `,
    );

    await queryRunner.query(
      `CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "video_id" uuid NOT NULL, "user_id" uuid NOT NULL, "parent_id" uuid, "text" text NOT NULL, "like_count" integer NOT NULL DEFAULT '0', "dislike_count" integer NOT NULL DEFAULT '0', "reply_count" integer NOT NULL DEFAULT '0', "edited_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_comments" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_video_latest" ON "comments" ("video_id", "created_at", "id") WHERE "parent_id" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_video_top" ON "comments" ("video_id", "like_count", "created_at", "id") WHERE "parent_id" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_parent" ON "comments" ("parent_id", "created_at", "id") `,
    );

    await queryRunner.query(
      `CREATE TABLE "comment_reactions" ("user_id" uuid NOT NULL, "comment_id" uuid NOT NULL, "value" "public"."reaction_value" NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_comment_reactions" PRIMARY KEY ("user_id", "comment_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comment_reactions_comment_id" ON "comment_reactions" ("comment_id") `,
    );

    await queryRunner.query(
      `CREATE TABLE "subscriptions" ("user_id" uuid NOT NULL, "channel_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_subscriptions" PRIMARY KEY ("user_id", "channel_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_subscriptions_channel_id" ON "subscriptions" ("channel_id") `,
    );

    await queryRunner.query(
      `ALTER TABLE "channels" ADD "subscriber_count" integer NOT NULL DEFAULT '0'`,
    );

    await queryRunner.query(
      `ALTER TABLE "video_reactions" ADD CONSTRAINT "FK_video_reactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_reactions" ADD CONSTRAINT "FK_video_reactions_video" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_video" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_parent" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_reactions" ADD CONSTRAINT "FK_comment_reactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_reactions" ADD CONSTRAINT "FK_comment_reactions_comment" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_channel" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_channel"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_reactions" DROP CONSTRAINT "FK_comment_reactions_comment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comment_reactions" DROP CONSTRAINT "FK_comment_reactions_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_parent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_video"`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_reactions" DROP CONSTRAINT "FK_video_reactions_video"`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_reactions" DROP CONSTRAINT "FK_video_reactions_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" DROP COLUMN "subscriber_count"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_subscriptions_channel_id"`,
    );
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_comment_reactions_comment_id"`,
    );
    await queryRunner.query(`DROP TABLE "comment_reactions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_comments_parent"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_comments_video_top"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_comments_video_latest"`);
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_video_reactions_video_id"`,
    );
    await queryRunner.query(`DROP TABLE "video_reactions"`);
    await queryRunner.query(`DROP TYPE "public"."reaction_value"`);
  }
}
