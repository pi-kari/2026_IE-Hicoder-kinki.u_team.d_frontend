import {
	index,
	integer,
	pgTable,
	serial,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";

// 旧 FastAPI の app/models.py からの移植。
// items テーブルはフロントから一切参照されていないため移植していない。

export const users = pgTable(
	"users",
	{
		userId: serial("user_id").primaryKey(),
		username: varchar("username").notNull(),
		// models.py では Mapped[str] (= NOT NULL) だが、register.tsx は username しか
		// 送らず UserCreate も None を既定値にしている。NOT NULL にすると新規登録が
		// 動かなくなる。Postgres は unique 制約下で NULL 同士を衝突扱いしないので、
		// nullable + unique の組み合わせで問題ない。
		userMailAddress: varchar("user_mail_address"),
		numberOfBooks: integer("number_of_books").notNull().default(0),
	},
	(t) => [
		uniqueIndex("ix_users_username").on(t.username),
		uniqueIndex("ix_users_user_mail_address").on(t.userMailAddress),
	],
);

export const books = pgTable(
	"books_list",
	{
		bookId: serial("book_id").primaryKey(),
		// SQLAlchemy の delete-orphan は ORM 層だけの機能で、create_all が吐く DDL に
		// ON DELETE は含まれない。挙動を合わせるためここでも指定しない。
		userId: integer("user_id")
			.notNull()
			.references(() => users.userId),
		bookTitle: varchar("book_title").notNull(),
		status: varchar("status").notNull().default("積読"),
		bookPages: integer("book_pages").notNull(),
		totalProgress: integer("total_progress").notNull().default(0),
		treeRatio: integer("tree_ratio").notNull().default(0),
		treeState: integer("tree_state").notNull().default(1),
	},
	(t) => [
		index("ix_books_list_user_id").on(t.userId),
		index("ix_books_list_book_title").on(t.bookTitle),
	],
);

export const progress = pgTable(
	"progress",
	{
		progressId: serial("progress_id").primaryKey(),
		bookId: integer("book_id")
			.notNull()
			.references(() => books.bookId),
		userId: integer("user_id")
			.notNull()
			.references(() => users.userId),
		// timestamptz。旧スキーマは naive timestamp + コンテナの TZ=Asia/Tokyo 依存
		// だったが、DB を作り直す前提なので絶対時刻で持つ。これにより JST の日境界計算が
		// Node のタイムゾーン設定に一切依存しなくなる (lib/jst.ts 参照)。
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		progress: integer("progress").notNull().default(0),
	},
	(t) => [
		index("ix_progress_book_id").on(t.bookId),
		index("ix_progress_user_id").on(t.userId),
	],
);
