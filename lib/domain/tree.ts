import { and, eq, sql } from "drizzle-orm";
import { books, progress } from "../schema";
import type { DomainDb } from "./db";

type BookRow = typeof books.$inferSelect;

/** routers/progress.py:get_tree_state + crud.get_book_tree_state
 *  null === Book not found */
export async function getTreeState(
	db: DomainDb,
	userId: number,
	bookId: number,
): Promise<Pick<BookRow, "treeRatio" | "treeState"> | null> {
	const [tree] = await db
		.select({ treeRatio: books.treeRatio, treeState: books.treeState })
		.from(books)
		.where(and(eq(books.bookId, bookId), eq(books.userId, userId)))
		.limit(1);

	return tree ?? null;
}

/**
 * 派生カラム (total_progress / tree_ratio / tree_state) を progress 行から数え直す。
 * crud.insert_book_progress + crud._update_tree_state 相当。
 *
 * **合計は必ず SUM(progress) から導出する。呼び出し側が渡した値は使わない。**
 * これが同期設計の要になる: 2 端末が別々にオフラインで記録して push したとき、
 * 後着の push が古い見立ての値でサーバ行を上書きするのを防げる。
 *
 * 2 段書き込み (クランプ前 → クランプ後) は FastAPI の順序そのままで、
 * 既知バグ #4 の再現でもある。詳細は下のコメント。動かさないこと。
 */
export async function recomputeBook(
	db: DomainDb,
	userId: number,
	bookId: number,
	bookPages: number,
): Promise<BookRow> {
	// sum(integer) は bigint なので pg は文字列で返す。SQL 側で ::int にキャストし、
	// coalesce で Python の `db_progress or 0` も同時に再現する。
	const [{ total }] = await db
		.select({ total: sql<number>`coalesce(sum(${progress.progress}), 0)::int` })
		.from(progress)
		.where(and(eq(progress.bookId, bookId), eq(progress.userId, userId)));

	// Python の int() は 0 方向切り捨てなので Math.trunc が対応する。
	// 1e-8 はゼロ除算ガード。total=50 / pages=100 が 49 になる癖もこれで再現される。
	const rawRatio = Math.trunc((total / (bookPages + 1e-8)) * 100);

	// crud.insert_book_progress と同じ順序で「クランプ前の値」をまず書く。
	// book_pages = 0 だと rawRatio ≈ 1e10 が int4 を超えてここで例外になり、
	// トランザクションごと巻き戻って 500 になる (既知バグ #4 の再現)。
	// クランプを前倒しするとこのバグが消えてパリティが崩れるので動かさないこと。
	// (修正は Phase 2)
	await db
		.update(books)
		.set({ totalProgress: total, treeRatio: rawRatio })
		.where(and(eq(books.userId, userId), eq(books.bookId, bookId)));

	// crud._update_tree_state 相当
	let treeRatio = rawRatio;
	let treeState: number;
	if (treeRatio >= 100) {
		treeRatio = 100;
		treeState = 3;
	} else if (treeRatio >= 50) {
		treeState = 2;
	} else {
		treeState = 1;
	}

	const [updated] = await db
		.update(books)
		.set({ treeRatio, treeState })
		.where(and(eq(books.userId, userId), eq(books.bookId, bookId)))
		.returning();

	return updated;
}
