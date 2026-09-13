import { and, eq, sql } from "drizzle-orm";
import { books, progress } from "../schema";
import type { DomainDb } from "./db";

type BookRow = typeof books.$inferSelect;

/** routers/progress.py:get_tree_state + crud.get_book_tree_state
 *  null === Book not found */
export async function getTreeState(
	db: DomainDb,
	userId: string,
	bookId: string,
): Promise<Pick<BookRow, "treeRatio" | "treeState"> | null> {
	const [tree] = await db
		.select({ treeRatio: books.treeRatio, treeState: books.treeState })
		.from(books)
		.where(and(eq(books.bookId, bookId), eq(books.userId, userId)))
		.limit(1);

	return tree ?? null;
}

/** tree_ratio から木の段階を決める。1 = 芽 / 2 = 育成中 / 3 = 完成。 */
function treeStateFor(ratio: number): number {
	if (ratio >= 100) return 3;
	if (ratio >= 50) return 2;
	return 1;
}

/**
 * 派生カラム (total_progress / tree_ratio / tree_state) を progress 行から数え直す。
 *
 * **到達位置は必ず MAX(progress) から導出する。呼び出し側が渡した値は使わない。**
 * これが同期設計の要になる: 2 端末が別々にオフラインで記録して push したとき、
 * 後着の push が古い見立ての値でサーバ行を上書きするのを防げる。
 *
 * progress 行は「その回に読み終わったページ番号」を持つ (読んだページ数ではない)。
 * なので合計ではなく最大値が到達位置になる。**MAX は SUM より同期に強い**:
 * 2 端末が同じ範囲を重複して記録しても二重計上されず、同じ行が 2 度届いても
 * 結果が変わらない (SUM だと読んでいないページまで進んでしまう)。
 *
 * 既知バグ #1 / #4 修正済み。以前はここが 2 段書き込みで、
 *   - ゼロ除算ガードの `book_pages + 1e-8` のせいで 120/120 が 99 にしかならず
 *     tree_state 3 に一度も到達できなかった (バグ #1)
 *   - book_pages = 0 だと比が約 100 億になり、クランプ前の値を先に書いていたため
 *     int4 を溢れてトランザクションごと 500 になっていた (バグ #4)
 * 今はクランプしてから 1 回だけ書く。
 */
export async function recomputeBook(
	db: DomainDb,
	userId: string,
	bookId: string,
	bookPages: number,
	updatedAt: Date,
): Promise<BookRow> {
	// coalesce で「1 行も無ければ 0」を表現する。
	const [{ total }] = await db
		.select({ total: sql<number>`coalesce(max(${progress.progress}), 0)::int` })
		.from(progress)
		.where(and(eq(progress.bookId, bookId), eq(progress.userId, userId)));

	// ページ数 0 の本は比を定義できないので 0 とする。
	// これで int4 オーバーフローの経路自体が消える。
	const ratio =
		bookPages <= 0 ? 0 : Math.min(100, Math.trunc((total / bookPages) * 100));

	const [updated] = await db
		.update(books)
		.set({
			totalProgress: total,
			treeRatio: ratio,
			treeState: treeStateFor(ratio),
			updatedAt,
		})
		.where(and(eq(books.userId, userId), eq(books.bookId, bookId)))
		.returning();

	return updated;
}
