// scripts/gen-migrations.ts が生成。手で編集しない。
// 元ファイル: drizzle/0000_equal_thena.sql, drizzle/0001_fantastic_dreaming_celestial.sql, lib/local/0000_local.sql
export const MIGRATION_SQL: { tag: string; sql: string }[] = [
	{
		tag: "0000_equal_thena",
		sql: `CREATE TABLE "books_list" (
	"book_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"book_title" varchar NOT NULL,
	"status" varchar DEFAULT '積読' NOT NULL,
	"book_pages" integer NOT NULL,
	"total_progress" integer DEFAULT 0 NOT NULL,
	"tree_ratio" integer DEFAULT 0 NOT NULL,
	"tree_state" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"progress_id" uuid PRIMARY KEY NOT NULL,
	"book_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" varchar NOT NULL,
	"user_mail_address" varchar,
	"number_of_books" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "books_list" ADD CONSTRAINT "books_list_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_book_id_books_list_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books_list"("book_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_books_list_user_id" ON "books_list" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_books_list_book_title" ON "books_list" USING btree ("book_title");--> statement-breakpoint
CREATE INDEX "ix_progress_book_id" ON "progress" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "ix_progress_user_id" ON "progress" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_users_user_mail_address" ON "users" USING btree ("user_mail_address");`,
	},
	{
		tag: "0001_fantastic_dreaming_celestial",
		sql: `CREATE TABLE "transfer_codes" (
	"code_hash" varchar PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"secret_hash" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"token_hash" varchar PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ix_transfer_codes_user_id" ON "transfer_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_user_sessions_user_id" ON "user_sessions" USING btree ("user_id");`,
	},
	{
		tag: "local_0000",
		sql: `-- ローカル専用テーブル。サーバには存在しない。
-- drizzle-kit には食わせないので手で維持する。
--
-- outbox: オフライン中の書き込みを貯め、オンライン復帰時にサーバへ送る。
-- id は uuidv7 なので「id 昇順 = 因果順」になり、そのまま送信順に使える。
-- これにより book.create が必ずその本の progress.record より先にサーバへ届く
-- (サーバ側には実 FK がある)。
CREATE TABLE IF NOT EXISTS outbox (
	id          uuid PRIMARY KEY,
	op          text NOT NULL,
	entity_id   uuid NOT NULL,
	payload     jsonb NOT NULL,
	created_at  timestamptz NOT NULL DEFAULT now(),
	attempts    integer NOT NULL DEFAULT 0,
	next_try_at timestamptz NOT NULL DEFAULT now(),
	failed_at   timestamptz,
	last_error  text
);
CREATE INDEX IF NOT EXISTS ix_outbox_pending ON outbox (id) WHERE failed_at IS NULL;
`,
	},
];
