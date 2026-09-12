import { getProgressOnDay } from "@/lib/domain/progress";
import { bookNotFound, intParam, withErrorHandling } from "@/lib/http";
import { todayInJst } from "@/lib/jst";
import { toTodayProgressResponse } from "@/lib/serialize";
import { db } from "@/lib/server/db";

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

	const total = await getProgressOnDay(
		db,
		userId.value,
		bookId.value,
		todayInJst(),
	);
	if (total === null) return bookNotFound();

	return Response.json(toTodayProgressResponse(total));
});
