import { getBook, updateBook } from "@/lib/domain/books";
import {
	bookNotFound,
	jsonBody,
	uuidParam,
	withErrorHandling,
} from "@/lib/http";
import { BookUpdateBody } from "@/lib/requests";
import { toBookResponse } from "@/lib/serialize";
import { requireOwner } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ user_id: string; book_id: string }> };

// routers/items.py:return_book + crud.get_book
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

	const book = await getBook(db, userId.value, bookId.value);
	if (!book) return bookNotFound();

	return Response.json(toBookResponse(book));
});

// routers/items.py:update_book + crud.update_book
// 既知バグ #3 修正済み: status も更新する。
export const POST = withErrorHandling(async (request: Request, ctx: Ctx) => {
	const { user_id, book_id } = await ctx.params;
	const userId = uuidParam("user_id", user_id);
	if (!userId.ok) return userId.response;

	// セッションの持ち主以外は触れない。user_id は引き継ぎのために
	// 画面に出す値なので、資格情報として扱わない。
	const session = await requireOwner(request, userId.value);
	if (!session.ok) return session.response;
	const bookId = uuidParam("book_id", book_id);
	if (!bookId.ok) return bookId.response;

	const body = await jsonBody(request, BookUpdateBody);
	if (!body.ok) return body.response;

	const updated = await updateBook(db, userId.value, bookId.value, {
		bookTitle: body.data.book_title,
		status: body.data.status,
		bookPages: body.data.book_pages,
		updatedAt: new Date(),
	});
	if (!updated) return bookNotFound();

	return Response.json(toBookResponse(updated));
});
