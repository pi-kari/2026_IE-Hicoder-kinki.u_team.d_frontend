import { getHistory, recordProgress } from "@/lib/domain/progress";
import {
	bookNotFound,
	intParam,
	intQuery,
	jsonBody,
	withErrorHandling,
} from "@/lib/http";
import { ProgressRequestBody } from "@/lib/requests";
import { toProgressResponse, toProgressUpdateResponse } from "@/lib/serialize";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ user_id: string; book_id: string }> };

// routers/progress.py:get_book_progress + crud.get_book_progress_history
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

	// limit は検証だけして使わない。既知バグ #2 の詳細は getHistory 側のコメント参照。
	void limit.value;
	const result = await getHistory(db, userId.value, bookId.value, {
		offset: offset.value,
	});
	if (!result) return bookNotFound();

	return Response.json(
		toProgressResponse(result.totalProgress, result.history),
	);
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

	const result = await recordProgress(
		db,
		userId.value,
		bookId.value,
		body.data.pages_read,
	);
	if (!result) return bookNotFound();

	return Response.json(toProgressUpdateResponse(result));
});
