// scripts/gen-migrations.ts が生成。手で編集しない。
// 元ファイル: drizzle/0000_equal_thena.sql, drizzle/0001_fantastic_dreaming_celestial.sql, drizzle/0002_puzzling_wrecker.sql, drizzle/0003_progress_to_page_reached.sql, drizzle/0004_panoramic_miracleman.sql, lib/local/0000_local.sql, lib/local/0001_local.sql, lib/local/0002_local.sql
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
		tag: "0002_puzzling_wrecker",
		sql: `ALTER TABLE "books_list" ADD COLUMN "isbn" varchar(13);`,
	},
	{
		tag: "0003_progress_to_page_reached",
		sql: `-- progress.progress の意味を変える。
--   旧: その回に読んだページ数 (加算)     total_progress = SUM
--   新: その回に読み終わったページ番号     total_progress = MAX
--
-- 既存行は「先頭からの累積和」に置き換える。これで意味が揃うだけでなく、
-- **派生カラムも書き換えずに済む**: 累積和の最大値 = もとの合計 なので、
-- total_progress / tree_ratio / tree_state は今の値のまま正しい。
-- 日別の集計 (getProgressOnDay) も「日末の到達位置 − 日初の到達位置」に
-- 変わるが、累積和なら変換前の日別合計と一致する。
--
-- progress_id は uuidv7 なので昇順 = 作成順。created_at は端末が打つ値で
-- 端末間の時計ずれを含むため、順序付けには使わない。
WITH cumulative AS (
	SELECT
		progress_id,
		SUM(progress) OVER (
			PARTITION BY book_id
			ORDER BY progress_id
			ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
		) AS position
	FROM progress
)
UPDATE progress AS p
SET progress = c.position
FROM cumulative AS c
WHERE p.progress_id = c.progress_id;
`,
	},
	{
		tag: "0004_panoramic_miracleman",
		sql: `CREATE INDEX "ix_books_list_isbn" ON "books_list" USING btree ("user_id","isbn");`,
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
	{
		tag: "local_0001",
		sql: `-- ローカル専用テーブル (第 2 弾)。サーバには存在しない。
--
-- **0000_local.sql に追記してはいけない。** 既に起動したことのある端末は
-- _local_migrations に local_0000 を記録済みで、あのファイルは二度と実行されない。
-- ローカル専用の追加は必ず新しい 000N_local.sql を作ること。
--
-- book_covers: ISBN から取得した表紙を data URI で持つ。
-- **同期しない。** 1 冊あたり数 KB〜数十 KB あり、同期ペイロードとサーバ DB を
-- 膨らませるだけで、books_list.isbn があればいつでも引き直せる。
-- 本ではなく ISBN を主キーにしているのは、同じ本を 2 回登録しても 1 枚で済むから。
CREATE TABLE IF NOT EXISTS book_covers (
	isbn       text PRIMARY KEY,
	data_uri   text NOT NULL,
	fetched_at timestamptz NOT NULL DEFAULT now()
);
`,
	},
	{
		tag: "local_0002",
		sql: `-- ローカル専用テーブル (第 3 弾)。サーバには存在しない。
--
-- **0000_local.sql / 0001_local.sql に追記してはいけない。** 起動済みの端末は
-- _local_migrations にその tag を記録済みで、あれらは二度と実行されない。
--
-- 未送信の outbox に残っている progress.record の payload を、
-- 0003_progress_to_page_reached と同じ意味に直す。
--
-- これを忘れると、アップデート前にオフラインで記録して未送信だったぶんが
-- 「読んだページ数」のままサーバへ届き、到達位置 (MAX) より小さい値として
-- 黙って捨てられる。progress テーブルは 0003 で既に変換済みなので、
-- そこから写すのが最も確実。
--
-- 0003 はドリズルの journal 側にあり、gen-migrations.ts が生成する配列では
-- local_* より前に並ぶので、ここに来た時点で変換は終わっている。
UPDATE outbox AS o
SET payload = jsonb_set(o.payload, '{progress}', to_jsonb(p.progress))
FROM progress AS p
WHERE o.op = 'progress.record'
  AND p.progress_id = o.entity_id;
`,
	},
];
