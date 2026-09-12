import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	intParam,
	jsonBody,
	userNotFound,
	withErrorHandling,
} from "@/lib/http";
import { BookCreateBody } from "@/lib/requests";
import { books, users } from "@/lib/schema";
import { toBookResponse } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ user_id: string }> };

// routers/items.py:return_book_list + crud.get_books
// NOTE: ユーザが存在しなくても 404 ではなく空配列を返す（現行の挙動）。
export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
	const { user_id } = await ctx.params;
	const userId = intParam("user_id", user_id);
	if (!userId.ok) return userId.response;

	const rows = await db
		.select()
		.from(books)
		.where(eq(books.userId, userId.value));

	return Response.json(rows.map(toBookResponse));
});

// routers/items.py:create_user_book
export const PUT = withErrorHandling(async (request: Request, ctx: Ctx) => {
	const { user_id } = await ctx.params;
	const userId = intParam("user_id", user_id);
	if (!userId.ok) return userId.response;

	const body = await jsonBody(request, BookCreateBody);
	if (!body.ok) return body.response;

	const created = await db.transaction(async (tx) => {
		const [user] = await tx
			.select({ userId: users.userId })
			.from(users)
			.where(eq(users.userId, userId.value))
			.limit(1);
		if (!user) return null;

		// 既知バグ #3 の再現: body.status は意図的に渡さない。
		// FastAPI 側も渡しておらず、DB 既定値の "積読" が入る。（修正は Phase 3）
		const [book] = await tx
			.insert(books)
			.values({
				userId: userId.value,
				bookTitle: body.data.book_title,
				bookPages: body.data.book_pages,
			})
			.returning();

		// FastAPI は db_user.number_of_books += 1 と read-modify-write していたが、
		// 同時実行で取りこぼすので SQL 側の加算にする（観測可能な挙動は同じ）。
		await tx
			.update(users)
			.set({ numberOfBooks: sql`${users.numberOfBooks} + 1` })
			.where(eq(users.userId, userId.value));

		return book;
	});

	if (!created) return userNotFound();

	return Response.json(toBookResponse(created));
});
