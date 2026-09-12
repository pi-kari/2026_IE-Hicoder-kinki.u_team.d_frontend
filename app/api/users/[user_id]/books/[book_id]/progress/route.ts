import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	bookNotFound,
	intParam,
	intQuery,
	jsonBody,
	withErrorHandling,
} from "@/lib/http";
import { ProgressRequestBody } from "@/lib/requests";
import { books, progress } from "@/lib/schema";
import { toProgressResponse, toProgressUpdateResponse } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ user_id: string; book_id: string }> };

// routers/progress.py:get_book_progress + crud.get_book_progress_history
//
// 既知バグ #2 の再現: limit/offset は本来 progress 行に効くべきだが、FastAPI では
// Book 側のクエリに .offset(offset).limit(limit).first() として適用されている。
// その結果 offset>=1 や limit<=0 だと本が「見つからない」ことになり 404 になる。
// ここでも同じ場所に適用して挙動を揃える。（修正は Phase 3）
export const GET = withErrorHandling(async (request: Request, ctx: Ctx) => {
	const { user_id, book_id } = await ctx.params;
	const userId = intParam("user_id", user_id);
	if (!userId.ok) return userId.response;
	const bookId = intParam("book_id", book_id);
	if (!bookId.ok) return bookId.response;

	const url = new URL(request.url);
	const limit = intQuery("limit", url.searchParams.get("limit"), 20);
	if (!limit.ok) return limit.response;
	const offset = intQuery("offset", url.searchParams.get("offset"), 0);
	if (!offset.ok) return offset.response;

	// FastAPI: .offset(offset).limit(limit).first()
	// SQLAlchemy の Query.first() は LIMIT 1 を「上書き」して設定するため、
	// .limit(limit) は SQL に一切届かない。実際に効くのは offset だけ。
	// そのため limit=0 や負値でも 200 が返り、offset>=1 のときだけ 404 になる。
	// （limit を素直に適用すると limit=0 で 404 になってしまい挙動がズレる）
	void limit.value;
	const [book] = await db
		.select()
		.from(books)
		.where(and(eq(books.userId, userId.value), eq(books.bookId, bookId.value)))
		.offset(offset.value)
		.limit(1);

	if (!book) return bookNotFound();

	// FastAPI 側は db_book.progresses リレーション（book_id のみで結合）を使っており、
	// user_id では絞っていない。order_by も無くヒープ順依存だったので、
	// 決定的にするため progress_id 昇順を明示する。
	const history = await db
		.select({ createdAt: progress.createdAt, progress: progress.progress })
		.from(progress)
		.where(eq(progress.bookId, bookId.value))
		.orderBy(asc(progress.progressId));

	return Response.json(toProgressResponse(book.totalProgress, history));
});

// routers/progress.py:update_book_progress + crud.insert_book_progress / _update_tree_state
export const POST = withErrorHandling(async (request: Request, ctx: Ctx) => {
	const { user_id, book_id } = await ctx.params;
	const userId = intParam("user_id", user_id);
	if (!userId.ok) return userId.response;
	const bookId = intParam("book_id", book_id);
	if (!bookId.ok) return bookId.response;

	const body = await jsonBody(request, ProgressRequestBody);
	if (!body.ok) return body.response;

	const result = await db.transaction(async (tx) => {
		const [book] = await tx
			.select()
			.from(books)
			.where(
				and(eq(books.userId, userId.value), eq(books.bookId, bookId.value)),
			)
			.limit(1);
		if (!book) return null;

		await tx.insert(progress).values({
			bookId: bookId.value,
			userId: userId.value,
			progress: body.data.pages_read,
		});

		// sum(integer) は bigint なので pg は文字列で返す。SQL 側で ::int にキャストし、
		// coalesce で Python の `db_progress or 0` も同時に再現する。
		const [{ total }] = await tx
			.select({
				total: sql<number>`coalesce(sum(${progress.progress}), 0)::int`,
			})
			.from(progress)
			.where(
				and(
					eq(progress.bookId, bookId.value),
					eq(progress.userId, userId.value),
				),
			);

		// Python の int() は 0 方向切り捨てなので Math.trunc が対応する。
		// 1e-8 はゼロ除算ガード。total=50 / pages=100 が 49 になる癖もこれで再現される。
		const rawRatio = Math.trunc((total / (book.bookPages + 1e-8)) * 100);

		// crud.insert_book_progress と同じ順序で「クランプ前の値」をまず書く。
		// book_pages = 0 だと rawRatio ≈ 1e10 が int4 を超えてここで例外になり、
		// トランザクションごと巻き戻って 500 になる（既知バグ #4 の再現）。
		// クランプを前倒しするとこのバグが消えてパリティが崩れるので動かさないこと。
		// （修正は Phase 3）
		await tx
			.update(books)
			.set({ totalProgress: total, treeRatio: rawRatio })
			.where(
				and(eq(books.userId, userId.value), eq(books.bookId, bookId.value)),
			);

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

		const [updated] = await tx
			.update(books)
			.set({ treeRatio, treeState })
			.where(
				and(eq(books.userId, userId.value), eq(books.bookId, bookId.value)),
			)
			.returning();

		return updated;
	});

	if (!result) return bookNotFound();

	return Response.json(toProgressUpdateResponse(result));
});
