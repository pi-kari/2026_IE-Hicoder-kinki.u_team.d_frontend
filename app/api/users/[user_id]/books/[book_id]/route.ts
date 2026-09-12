import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	bookNotFound,
	intParam,
	jsonBody,
	withErrorHandling,
} from "@/lib/http";
import { BookCreateBody } from "@/lib/requests";
import { books } from "@/lib/schema";
import { toBookResponse } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ user_id: string; book_id: string }> };

// routers/items.py:return_book + crud.get_book
export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
	const { user_id, book_id } = await ctx.params;
	const userId = intParam("user_id", user_id);
	if (!userId.ok) return userId.response;
	const bookId = intParam("book_id", book_id);
	if (!bookId.ok) return bookId.response;

	const [book] = await db
		.select()
		.from(books)
		.where(and(eq(books.userId, userId.value), eq(books.bookId, bookId.value)))
		.limit(1);

	if (!book) return bookNotFound();

	return Response.json(toBookResponse(book));
});

// routers/items.py:update_book + crud.update_book
// NOTE: 更新するのはタイトルとページ数だけ。status は無視する（既知バグ #3）。
export const POST = withErrorHandling(async (request: Request, ctx: Ctx) => {
	const { user_id, book_id } = await ctx.params;
	const userId = intParam("user_id", user_id);
	if (!userId.ok) return userId.response;
	const bookId = intParam("book_id", book_id);
	if (!bookId.ok) return bookId.response;

	const body = await jsonBody(request, BookCreateBody);
	if (!body.ok) return body.response;

	const [updated] = await db
		.update(books)
		.set({
			bookTitle: body.data.book_title,
			bookPages: body.data.book_pages,
		})
		.where(and(eq(books.userId, userId.value), eq(books.bookId, bookId.value)))
		.returning();

	if (!updated) return bookNotFound();

	return Response.json(toBookResponse(updated));
});
