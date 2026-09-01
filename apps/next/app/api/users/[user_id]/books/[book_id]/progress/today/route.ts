import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookNotFound, intParam, withErrorHandling } from "@/lib/http";
import { jstDayRange, todayInJst } from "@/lib/jst";
import { books, progress } from "@/lib/schema";
import { toTodayProgressResponse } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ user_id: string; book_id: string }> };

// routers/progress.py:get_book_progress_today
//   + crud.get_book_progress_today / get_book_progress_by_date
export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
	const { user_id, book_id } = await ctx.params;
	const userId = intParam("user_id", user_id);
	if (!userId.ok) return userId.response;
	const bookId = intParam("book_id", book_id);
	if (!bookId.ok) return bookId.response;

	// FastAPI 側と同じく、まず本の存在チェック
	const [book] = await db
		.select({ bookId: books.bookId })
		.from(books)
		.where(and(eq(books.userId, userId.value), eq(books.bookId, bookId.value)))
		.limit(1);
	if (!book) return bookNotFound();

	const { start, end } = jstDayRange(todayInJst());

	const [{ total }] = await db
		.select({ total: sql<number>`coalesce(sum(${progress.progress}), 0)::int` })
		.from(progress)
		.where(
			and(
				eq(progress.bookId, bookId.value),
				eq(progress.userId, userId.value),
				gte(progress.createdAt, start),
				lt(progress.createdAt, end),
			),
		);

	return Response.json(toTodayProgressResponse(total));
});
