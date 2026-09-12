import { getHistory, recordProgress } from "@/lib/domain/progress";
import {
	bookNotFound,
	intQuery,
	jsonBody,
	uuidParam,
	withErrorHandling,
} from "@/lib/http";
import { ProgressRequestBody } from "@/lib/requests";
import { toProgressResponse, toProgressUpdateResponse } from "@/lib/serialize";
import { db } from "@/lib/server/db";
import { uuidv7 } from "@/lib/uuid";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ user_id: string; book_id: string }> };

// routers/progress.py:get_book_progress + crud.get_book_progress_history
// 既知バグ #2 修正済み: limit / offset は progress 行に効く。
export const GET = withErrorHandling(async (request: Request, ctx: Ctx) => {
	const { user_id, book_id } = await ctx.params;
	const userId = uuidParam("user_id", user_id);
	if (!userId.ok) return userId.response;
	const bookId = uuidParam("book_id", book_id);
	if (!bookId.ok) return bookId.response;

	const url = new URL(request.url);
	const limit = intQuery("limit", url.searchParams.get("limit"), 20);
	if (!limit.ok) return limit.response;
	const offset = intQuery("offset", url.searchParams.get("offset"), 0);
	if (!offset.ok) return offset.response;

	const result = await getHistory(db, userId.value, bookId.value, {
		// 負の limit/offset は SQL エラーになるので 0 に丸める。
		limit: Math.max(0, limit.value),
		offset: Math.max(0, offset.value),
	});
	if (!result) return bookNotFound();

	return Response.json(
		toProgressResponse(result.totalProgress, result.history),
	);
});

// routers/progress.py:update_book_progress + crud.insert_book_progress / _update_tree_state
//
// progress_id と created_at はここで作る。オフラインの端末から同期で送られてくる
// 行は、この経路ではなく Phase 4 の push エンドポイントを通り、
// 端末が記録した時刻をそのまま持ち込む。
export const POST = withErrorHandling(async (request: Request, ctx: Ctx) => {
	const { user_id, book_id } = await ctx.params;
	const userId = uuidParam("user_id", user_id);
	if (!userId.ok) return userId.response;
	const bookId = uuidParam("book_id", book_id);
	if (!bookId.ok) return bookId.response;

	const body = await jsonBody(request, ProgressRequestBody);
	if (!body.ok) return body.response;

	const result = await recordProgress(db, userId.value, bookId.value, {
		progressId: uuidv7(),
		pagesRead: body.data.pages_read,
		createdAt: new Date(),
	});
	if (!result) return bookNotFound();

	return Response.json(toProgressUpdateResponse(result));
});
