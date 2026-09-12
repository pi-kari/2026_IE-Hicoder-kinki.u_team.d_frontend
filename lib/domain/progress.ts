import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
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
 * 既知バグ #2 の再現: limit/offset は本来 progress 行に効くべきだが、FastAPI では
 * Book 側のクエリに .offset(offset).limit(limit).first() として適用されている。
 * さらに SQLAlchemy の Query.first() は LIMIT 1 を「上書き」するので .limit(limit) は
 * SQL に一切届かない。実際に効くのは offset だけで、offset>=1 だと本が「見つからない」
 * ことになり 404 になる。limit は受け取るが使わない。(修正は Phase 2) */
export async function getHistory(
	db: DomainDb,
	userId: number,
	bookId: number,
	opts: { offset: number },
): Promise<ProgressHistory | null> {
	const [book] = await db
		.select()
		.from(books)
		.where(and(eq(books.userId, userId), eq(books.bookId, bookId)))
		.offset(opts.offset)
		.limit(1);

	if (!book) return null;

	// FastAPI 側は db_book.progresses リレーション (book_id のみで結合) を使っており、
	// user_id では絞っていない。order_by も無くヒープ順依存だったので、
	// 決定的にするため progress_id 昇順を明示する。
	const history = await db
		.select({ createdAt: progress.createdAt, progress: progress.progress })
		.from(progress)
		.where(eq(progress.bookId, bookId))
		.orderBy(asc(progress.progressId));

	return { totalProgress: book.totalProgress, history };
}

/** routers/progress.py:update_book_progress
 *   + crud.insert_book_progress / _update_tree_state
 *  null === Book not found */
export async function recordProgress(
	db: DomainDb,
	userId: number,
	bookId: number,
	pagesRead: number,
): Promise<BookRow | null> {
	return db.transaction(async (tx) => {
		const [book] = await tx
			.select()
			.from(books)
			.where(and(eq(books.userId, userId), eq(books.bookId, bookId)))
			.limit(1);
		if (!book) return null;

		await tx.insert(progress).values({ bookId, userId, progress: pagesRead });

		return recomputeBook(tx, userId, bookId, book.bookPages);
	});
}

/** crud.get_book_progress_today / get_book_progress_by_date
 *  null === Book not found
 *  day は "YYYY-MM-DD" (JST の暦日)。 */
export async function getProgressOnDay(
	db: DomainDb,
	userId: number,
	bookId: number,
	day: string,
): Promise<number | null> {
	// FastAPI 側と同じく、まず本の存在チェック
	const [book] = await db
		.select({ bookId: books.bookId })
		.from(books)
		.where(and(eq(books.userId, userId), eq(books.bookId, bookId)))
		.limit(1);
	if (!book) return null;

	const { start, end } = jstDayRange(day);

	const [{ total }] = await db
		.select({ total: sql<number>`coalesce(sum(${progress.progress}), 0)::int` })
		.from(progress)
		.where(
			and(
				eq(progress.bookId, bookId),
				eq(progress.userId, userId),
				gte(progress.createdAt, start),
				lt(progress.createdAt, end),
			),
		);

	return total;
}
