import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import { jstDayRange } from "../jst";
import { books, progress } from "../schema";
import type { DomainDb } from "./db";
import { recomputeBook } from "./tree";

type BookRow = typeof books.$inferSelect;
type ProgressRow = typeof progress.$inferSelect;

export type ProgressHistory = {
	totalProgress: number;
	history: Pick<ProgressRow, "createdAt" | "progress">[];
};

/** routers/progress.py:get_book_progress + crud.get_book_progress_history
 *  null === Book not found
 *
 * 既知バグ #2 修正済み: 以前は limit/offset が progress 行ではなく Book 側の
 * クエリに掛かっており、offset>=1 だと本が「見つからない」ことになって 404、
 * limit は SQLAlchemy の .first() に上書きされて一切効いていなかった。
 * 今は素直に progress 行へ適用する。 */
export async function getHistory(
	db: DomainDb,
	userId: string,
	bookId: string,
	opts: { limit: number; offset: number },
): Promise<ProgressHistory | null> {
	const [book] = await db
		.select()
		.from(books)
		.where(and(eq(books.userId, userId), eq(books.bookId, bookId)))
		.limit(1);

	if (!book) return null;

	// progress_id は uuidv7 なので昇順 = 作成順。
	const history = await db
		.select({ createdAt: progress.createdAt, progress: progress.progress })
		.from(progress)
		.where(eq(progress.bookId, bookId))
		.orderBy(asc(progress.progressId))
		.limit(opts.limit)
		.offset(opts.offset);

	// total_progress は本の行にある派生値 (progress 行の合計) で、
	// ページングとは独立。切り出した一覧の合計ではない。
	return { totalProgress: book.totalProgress, history };
}

/** routers/progress.py:update_book_progress
 *   + crud.insert_book_progress / _update_tree_state
 *  null === Book not found
 *
 * progressId / createdAt は呼び出し側が渡す。
 * 火曜にオフラインで記録して木曜に push した行が木曜の日付になると、
 * lib/jst.ts が駆動する /today と /date/:d が壊れるため。
 *
 * `pageReached` は**そのとき読み終わったページ番号**。読んだページ数ではない
 * (例: 104 ページまで読んだら 104)。到達位置は MAX で導出するので、
 * 既に記録済みより小さい値を入れても総量は下がらない。 */
export async function recordProgress(
	db: DomainDb,
	userId: string,
	bookId: string,
	input: { progressId: string; pageReached: number; createdAt: Date },
): Promise<BookRow | null> {
	return db.transaction(async (tx) => {
		const [book] = await tx
			.select()
			.from(books)
			.where(and(eq(books.userId, userId), eq(books.bookId, bookId)))
			.limit(1);
		if (!book) return null;

		await tx.insert(progress).values({
			progressId: input.progressId,
			bookId,
			userId,
			progress: input.pageReached,
			createdAt: input.createdAt,
		});

		return recomputeBook(tx, userId, bookId, book.bookPages, input.createdAt);
	});
}

/** crud.get_book_progress_today / get_book_progress_by_date
 *  null === Book not found
 *  day は "YYYY-MM-DD" (JST の暦日)。
 *
 * progress 行は到達ページ番号なので、**その日に進んだぶんは行の合計ではなく
 * 「日の終わりの到達位置 − 日の始まりの到達位置」**。
 * その日に読み返して小さい番号を入れた場合でも負にはしない。 */
export async function getProgressOnDay(
	db: DomainDb,
	userId: string,
	bookId: string,
	day: string,
): Promise<number | null> {
	const [book] = await db
		.select({ bookId: books.bookId, bookPages: books.bookPages })
		.from(books)
		.where(and(eq(books.userId, userId), eq(books.bookId, bookId)))
		.limit(1);
	if (!book) return null;

	const { start, end } = jstDayRange(day);

	/** その時刻より前に到達していたページ番号。本の末尾で頭打ちにする。
	 *  recomputeBook と同じ扱いにしないと、ここだけ総ページ数を超えた値が出る。 */
	const positionBefore = async (bound: Date): Promise<number> => {
		const [{ pos }] = await db
			.select({ pos: sql<number>`coalesce(max(${progress.progress}), 0)::int` })
			.from(progress)
			.where(
				and(
					eq(progress.bookId, bookId),
					eq(progress.userId, userId),
					lt(progress.createdAt, bound),
				),
			);
		return book.bookPages > 0 ? Math.min(pos, book.bookPages) : pos;
	};

	const [atEnd, atStart] = await Promise.all([
		positionBefore(end),
		positionBefore(start),
	]);

	return Math.max(0, atEnd - atStart);
}

/** 直近に進捗を記録した本。無ければ null。
 *  ProgressTree が「どの本の木を出すか」を決めるのに使う
 *  (以前は bookId = 5 のハードコードだった / 既知バグ #6)。 */
export async function latestActiveBookId(
	db: DomainDb,
	userId: string,
): Promise<string | null> {
	// progress_id は uuidv7 なので降順の先頭が最新の記録。
	const [recent] = await db
		.select({ bookId: progress.bookId })
		.from(progress)
		.where(eq(progress.userId, userId))
		.orderBy(desc(progress.progressId))
		.limit(1);
	if (recent) return recent.bookId;

	// まだ 1 度も記録が無ければ、最後に登録した本を使う。
	const [newest] = await db
		.select({ bookId: books.bookId })
		.from(books)
		.where(eq(books.userId, userId))
		.orderBy(desc(books.bookId))
		.limit(1);

	return newest?.bookId ?? null;
}
