import {
	index,
	integer,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

// 旧 FastAPI の app/models.py からの移植。
// items テーブルはフロントから一切参照されていないため移植していない。
//
// 主キーはすべて uuid。**`.defaultRandom()` は付けない。**
// クライアントが id を送り忘れたときにサーバが勝手に採番すると、その id は
// クライアントに伝わらないので outbox の再送が重複行を作る。デフォルト無しなら
// NOT NULL 違反として即座に落ちる。値は lib/uuid.ts の uuidv7() で作る。

export const users = pgTable(
	"users",
	{
		userId: uuid("user_id").primaryKey(),
		username: varchar("username").notNull(),
		// models.py では Mapped[str] (= NOT NULL) だが、register.tsx は username しか
		// 送らず UserCreate も None を既定値にしている。NOT NULL にすると新規登録が
		// 動かなくなる。Postgres は unique 制約下で NULL 同士を衝突扱いしないので、
		// nullable + unique の組み合わせで問題ない。
		userMailAddress: varchar("user_mail_address"),
		numberOfBooks: integer("number_of_books").notNull().default(0),
		// 同期の LWW 用。値は呼び出し側が渡す (lib/domain/db.ts のコメント参照)。
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	// NOTE: ix_users_username (unique) は意図的に持たない。
	// 2 端末が同じ名前でオフライン登録すると 2 台目の user.create が push で
	// unique 違反になり、順序を保つ outbox ではそれ以降の全 op が永久に詰まる。
	// このアプリに username でのログインは無いので、この索引は何も買っていない。
	(t) => [uniqueIndex("ix_users_user_mail_address").on(t.userMailAddress)],
);

export const books = pgTable(
	"books_list",
	{
		bookId: uuid("book_id").primaryKey(),
		// SQLAlchemy の delete-orphan は ORM 層だけの機能で、create_all が吐く DDL に
		// ON DELETE は含まれない。挙動を合わせるためここでも指定しない。
		userId: uuid("user_id")
			.notNull()
			.references(() => users.userId),
		bookTitle: varchar("book_title").notNull(),
		status: varchar("status").notNull().default("積読"),
		bookPages: integer("book_pages").notNull(),
		// 以下 3 つは progress 行からの派生値。**同期しない・再計算する。**
		// 普通のカラムとして同期すると 2 端末でオフライン記録したとき片方が消える。
		// 再計算は lib/domain/tree.ts の recomputeBook だけが行う。
		totalProgress: integer("total_progress").notNull().default(0),
		treeRatio: integer("tree_ratio").notNull().default(0),
		treeState: integer("tree_state").notNull().default(1),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("ix_books_list_user_id").on(t.userId),
		index("ix_books_list_book_title").on(t.bookTitle),
	],
);

export const progress = pgTable(
	"progress",
	{
		progressId: uuid("progress_id").primaryKey(),
		bookId: uuid("book_id")
			.notNull()
			.references(() => books.bookId),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.userId),
		// timestamptz。旧スキーマは naive timestamp + コンテナの TZ=Asia/Tokyo 依存
		// だったが、DB を作り直す前提なので絶対時刻で持つ。これにより JST の日境界計算が
		// Node のタイムゾーン設定に一切依存しなくなる (lib/jst.ts 参照)。
		//
		// **値は必ず呼び出し側が渡す。defaultNow() は保険で、実際には発火しない。**
		// 火曜にオフラインで記録して木曜に push した行が木曜の日付になると、
		// lib/jst.ts が駆動する /today と /date/:d が壊れる。
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
