import { createBook, listBooks } from "@/lib/domain/books";
import {
	jsonBody,
	userNotFound,
	uuidParam,
	withErrorHandling,
} from "@/lib/http";
import { BookCreateBody } from "@/lib/requests";
import { toBookResponse } from "@/lib/serialize";
import { requireOwner } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ user_id: string }> };

// routers/items.py:return_book_list + crud.get_books
// NOTE: ユーザが存在しなくても 404 ではなく空配列を返す（現行の挙動）。
export const GET = withErrorHandling(async (request: Request, ctx: Ctx) => {
	const { user_id } = await ctx.params;
	const userId = uuidParam("user_id", user_id);
	if (!userId.ok) return userId.response;

	// セッションの持ち主以外は触れない。user_id は引き継ぎのために
	// 画面に出す値なので、資格情報として扱わない。
	const session = await requireOwner(request, userId.value);
	if (!session.ok) return session.response;

	const rows = await listBooks(db, userId.value);

	return Response.json(rows.map(toBookResponse));
});

// routers/items.py:create_user_book
export const PUT = withErrorHandling(async (request: Request, ctx: Ctx) => {
	const { user_id } = await ctx.params;
	const userId = uuidParam("user_id", user_id);
	if (!userId.ok) return userId.response;

	// セッションの持ち主以外は触れない。user_id は引き継ぎのために
	// 画面に出す値なので、資格情報として扱わない。
	const session = await requireOwner(request, userId.value);
	if (!session.ok) return session.response;

	const body = await jsonBody(request, BookCreateBody);
	if (!body.ok) return body.response;

	const created = await createBook(db, userId.value, {
		bookId: body.data.book_id,
		bookTitle: body.data.book_title,
		status: body.data.status,
		bookPages: body.data.book_pages,
		updatedAt: new Date(),
	});
	if (!created) return userNotFound();

	return Response.json(toBookResponse(created));
});
