import { and, eq, sql } from "drizzle-orm";
import { books, users } from "../schema";
import type { DomainDb } from "./db";

type BookRow = typeof books.$inferSelect;

/** routers/items.py:return_book_list + crud.get_books
 *  NOTE: ユーザが存在しなくても 404 ではなく空配列。現行の挙動。 */
export async function listBooks(
	db: DomainDb,
	userId: number,
): Promise<BookRow[]> {
	return db.select().from(books).where(eq(books.userId, userId));
}

/** routers/items.py:return_book + crud.get_book
 *  null === Book not found */
export async function getBook(
	db: DomainDb,
	userId: number,
	bookId: number,
): Promise<BookRow | null> {
	const [book] = await db
		.select()
		.from(books)
		.where(and(eq(books.userId, userId), eq(books.bookId, bookId)))
		.limit(1);

	return book ?? null;
}

/** routers/items.py:create_user_book
 *  null === User not found
 *
 * 本の作成と users.number_of_books の加算を 1 トランザクションにまとめる。
 * 呼び出し側が tx を渡した場合はネストして SAVEPOINT になる。 */
export async function createBook(
	db: DomainDb,
	userId: number,
	input: { bookTitle: string; bookPages: number },
): Promise<BookRow | null> {
	return db.transaction(async (tx) => {
		const [user] = await tx
			.select({ userId: users.userId })
			.from(users)
			.where(eq(users.userId, userId))
			.limit(1);
		if (!user) return null;

		// 既知バグ #3 の再現: status は意図的に渡さない。DB 既定値の "積読" が入る。
		// UI 側が文字列 "string" を送っているので、サーバだけ直すと全行が汚れる。
		// UI に状態選択を足すのとセットで直す (Phase 2)。
		const [book] = await tx
			.insert(books)
			.values({
				userId,
				bookTitle: input.bookTitle,
				bookPages: input.bookPages,
			})
			.returning();

		// FastAPI は db_user.number_of_books += 1 の read-modify-write だったが、
		// 同時実行で取りこぼすので SQL 側の加算にする (観測可能な挙動は同じ)。
		await tx
			.update(users)
			.set({ numberOfBooks: sql`${users.numberOfBooks} + 1` })
			.where(eq(users.userId, userId));

		return book;
	});
}

/** routers/items.py:update_book + crud.update_book
 *  null === Book not found
 *  NOTE: 更新するのはタイトルとページ数だけ。status は無視する (既知バグ #3)。 */
export async function updateBook(
	db: DomainDb,
	userId: number,
	bookId: number,
	input: { bookTitle: string; bookPages: number },
): Promise<BookRow | null> {
	const [updated] = await db
		.update(books)
		.set({ bookTitle: input.bookTitle, bookPages: input.bookPages })
		.where(and(eq(books.userId, userId), eq(books.bookId, bookId)))
		.returning();

	return updated ?? null;
}
