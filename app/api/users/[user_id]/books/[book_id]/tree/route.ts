import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookNotFound, intParam, withErrorHandling } from "@/lib/http";
import { books } from "@/lib/schema";
import { toTreeStateResponse } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ user_id: string; book_id: string }> };

// routers/progress.py:get_tree_state + crud.get_book_tree_state
export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
	const { user_id, book_id } = await ctx.params;
	const userId = intParam("user_id", user_id);
	if (!userId.ok) return userId.response;
	const bookId = intParam("book_id", book_id);
	if (!bookId.ok) return bookId.response;

	const [tree] = await db
		.select({ treeRatio: books.treeRatio, treeState: books.treeState })
		.from(books)
		.where(and(eq(books.bookId, bookId.value), eq(books.userId, userId.value)))
		.limit(1);

	if (!tree) return bookNotFound();

	return Response.json(toTreeStateResponse(tree));
});
