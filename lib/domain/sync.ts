import { and, eq, inArray, sql } from "drizzle-orm";
import { books, progress, users } from "../schema";
import { recomputeUser } from "./books";
import type { DomainDb } from "./db";
import { recomputeBook } from "./tree";

/**
 * 同期の適用。対話 API (lib/domain/{users,books,progress}.ts) とは
 * upsert の意味論が違うのでここに隔離する。
 *
 * 両側から呼ぶ:
 *   - サーバ: push エンドポイントが受け取った op を適用する
 *   - 端末:   pull した行をローカル DB にマージする
 *
 * 派生カラム (total_progress / tree_ratio / tree_state / number_of_books) は
 * **一切運ばない。触れた本ごとに recomputeBook で数え直す。**
 * 普通のカラムとして同期すると、2 端末が別々にオフラインで記録したとき
 * 後着が先着を上書きして片方の記録が消える。
 */

export type UserInput = {
	userId: string;
	username: string;
	updatedAt: Date;
	// user_mail_address は同期しない。同期に不要な個人情報で、
	// pull で返すと「user_id さえ分かれば誰でも取れるメールアドレス」になる。
	// 既存の行の値はこの経路では触らない。
};

export type BookInput = {
	bookId: string;
	userId: string;
	bookTitle: string;
	status: string;
	bookPages: number;
	updatedAt: Date;
};

export type ProgressInput = {
	progressId: string;
	bookId: string;
	userId: string;
	pagesRead: number;
	createdAt: Date;
};

/**
 * ユーザーを反映する。既にあれば `updated_at` が新しい方を採る (LWW)。
 *
 * 端末が生成した `updated_at` をそのまま比較する。サーバが now() を打つと
 * **編集順ではなく push の到着順**で勝者が決まってしまう
 * (A が火曜に改名、B が水曜に改名、A が後から送ると古い A が勝つ)。
 */
export async function upsertUser(db: DomainDb, input: UserInput) {
	await db
		.insert(users)
		.values({
			userId: input.userId,
			username: input.username,
			userMailAddress: null,
			updatedAt: input.updatedAt,
		})
		.onConflictDoUpdate({
			target: users.userId,
			set: {
				username: sql`excluded.username`,
				updatedAt: sql`excluded.updated_at`,
			},
			setWhere: sql`excluded.updated_at > ${users.updatedAt}`,
		});
}

/** 本を反映する。ユーザーが未着なら null (呼び出し側が rejected にする)。 */
export async function upsertBook(
	db: DomainDb,
	input: BookInput,
): Promise<{ ok: boolean }> {
	const [owner] = await db
		.select({ userId: users.userId })
		.from(users)
		.where(eq(users.userId, input.userId))
		.limit(1);
	if (!owner) return { ok: false };

	await db
		.insert(books)
		.values({
			bookId: input.bookId,
			userId: input.userId,
			bookTitle: input.bookTitle,
			status: input.status,
			bookPages: input.bookPages,
			updatedAt: input.updatedAt,
		})
		.onConflictDoUpdate({
			target: books.bookId,
			set: {
				bookTitle: sql`excluded.book_title`,
				status: sql`excluded.status`,
				bookPages: sql`excluded.book_pages`,
				updatedAt: sql`excluded.updated_at`,
			},
			setWhere: sql`excluded.updated_at > ${books.updatedAt}`,
		});

	await recomputeUser(db, input.userId);
	// ページ数が変わると比も変わる
	await recomputeBook(
		db,
		input.userId,
		input.bookId,
		input.bookPages,
		input.updatedAt,
	);
	return { ok: true };
}

/**
 * 進捗を反映する。本が未着なら null。
 *
 * progress は追記のみの不変な行なので、**同じ id なら何もしない**。
 * これで再送が何度起きても安全になり、2 端末の記録は自然に合算される。
 */
export async function applyProgress(
	db: DomainDb,
	input: ProgressInput,
): Promise<{ ok: boolean }> {
	const [book] = await db
		.select({ bookPages: books.bookPages })
		.from(books)
		.where(and(eq(books.bookId, input.bookId), eq(books.userId, input.userId)))
		.limit(1);
	if (!book) return { ok: false };

	await db
		.insert(progress)
		.values({
			progressId: input.progressId,
			bookId: input.bookId,
			userId: input.userId,
			progress: input.pagesRead,
			createdAt: input.createdAt,
		})
		.onConflictDoNothing({ target: progress.progressId });

	await recomputeBook(
		db,
		input.userId,
		input.bookId,
		book.bookPages,
		input.createdAt,
	);
	return { ok: true };
}

/** pull 用。そのユーザーに属する行をすべて返す。 */
export async function dumpUser(db: DomainDb, userId: string) {
	const userRows = await db
		.select()
		.from(users)
		.where(eq(users.userId, userId));
	const bookRows = await db
		.select()
		.from(books)
		.where(eq(books.userId, userId));
	const progressRows = await db
		.select()
		.from(progress)
		.where(eq(progress.userId, userId));

	return { users: userRows, books: bookRows, progress: progressRows };
}

/** マージ後に触れた本の派生カラムを数え直す。 */
export async function recomputeAll(
	db: DomainDb,
	userId: string,
	bookIds: string[],
	at: Date,
) {
	if (bookIds.length > 0) {
		const rows = await db
			.select({ bookId: books.bookId, bookPages: books.bookPages })
			.from(books)
			.where(and(eq(books.userId, userId), inArray(books.bookId, bookIds)));
		for (const row of rows) {
			// 1 冊で失敗しても残りを巻き込まない
			try {
				await recomputeBook(db, userId, row.bookId, row.bookPages, at);
			} catch (error) {
				console.error("recomputeBook に失敗しました", row.bookId, error);
			}
		}
	}
	await recomputeUser(db, userId);
}
