import { getProgressOnDay } from "@/lib/domain/progress";
import { bookNotFound, uuidParam, withErrorHandling } from "@/lib/http";
import { todayInJst } from "@/lib/jst";
import { toTodayProgressResponse } from "@/lib/serialize";
import { requireOwner } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ user_id: string; book_id: string }> };

// routers/progress.py:get_book_progress_today
//   + crud.get_book_progress_today / get_book_progress_by_date
export const GET = withErrorHandling(async (request: Request, ctx: Ctx) => {
	const { user_id, book_id } = await ctx.params;
	const userId = uuidParam("user_id", user_id);
	if (!userId.ok) return userId.response;

	// セッションの持ち主以外は触れない。user_id は引き継ぎのために
	// 画面に出す値なので、資格情報として扱わない。
	const session = await requireOwner(request, userId.value);
	if (!session.ok) return session.response;
	const bookId = uuidParam("book_id", book_id);
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
