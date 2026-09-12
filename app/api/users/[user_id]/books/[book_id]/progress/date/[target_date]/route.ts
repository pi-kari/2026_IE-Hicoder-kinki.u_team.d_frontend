import { getProgressOnDay } from "@/lib/domain/progress";
import {
	bookNotFound,
	intParam,
	unprocessable,
	withErrorHandling,
} from "@/lib/http";
import { parseIsoDate } from "@/lib/jst";
import { toTodayProgressResponse } from "@/lib/serialize";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

type Ctx = {
	params: Promise<{ user_id: string; book_id: string; target_date: string }>;
};

// routers/progress.py:get_book_progress_by_date_endpoint
//   + crud.get_book_progress_by_date
export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
	const { user_id, book_id, target_date } = await ctx.params;
	const userId = intParam("user_id", user_id);
	if (!userId.ok) return userId.response;
	const bookId = intParam("book_id", book_id);
	if (!bookId.ok) return bookId.response;

	// FastAPI ではパスパラメータの検証がハンドラ本体より先に走るので、
	// 不正な日付は本の存在チェック (404) より先に 422 になる。順序を合わせること。
	const day = parseIsoDate(target_date);
	if (day === null) {
		return unprocessable([
			{
				loc: ["path", "target_date"],
				msg: "Input should be a valid date or datetime, input is too short",
				type: "date_from_datetime_parsing",
			},
		]);
	}

	const total = await getProgressOnDay(db, userId.value, bookId.value, day);
	if (total === null) return bookNotFound();

	return Response.json(toTodayProgressResponse(total));
});
