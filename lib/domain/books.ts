import { and, eq, sql } from "drizzle-orm";
import { books, users } from "../schema";
import type { DomainDb } from "./db";

type BookRow = typeof books.$inferSelect;

/** routers/items.py:return_book_list + crud.get_books
 *  NOTE: ユーザが存在しなくても 404 ではなく空配列。現行の挙動。
 *  並びは book_id 昇順 = uuidv7 なので作成順。 */
export async function listBooks(
	db: DomainDb,
	userId: string,
): Promise<BookRow[]> {
	return db
		.select()
		.from(books)
		.where(eq(books.userId, userId))
		.orderBy(books.bookId);
}

/** routers/items.py:return_book + crud.get_book
 *  null === Book not found */
export async function getBook(
	db: DomainDb,
	userId: string,
	bookId: string,
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
	userId: string,
	input: {
		bookId: string;
		bookTitle: string;
		status: string;
		bookPages: number;
		updatedAt: Date;
	},
): Promise<BookRow | null> {
	return db.transaction(async (tx) => {
		const [user] = await tx
			.select({ userId: users.userId })
			.from(users)
			.where(eq(users.userId, userId))
			.limit(1);
		if (!user) return null;

		// 既知バグ #3 修正済み: 以前は status を捨てて DB 既定値の "積読" にしていた。
		// UI 側も文字列 "string" を送っていたので、両方まとめて直した。
		const [book] = await tx
			.insert(books)
			.values({
				bookId: input.bookId,
				userId,
				bookTitle: input.bookTitle,
				status: input.status,
				bookPages: input.bookPages,
				updatedAt: input.updatedAt,
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

/** users.number_of_books を books_list から数え直す。
 *  pull で本が増えたときに呼ぶ。派生値なので同期せず再計算する。 */
export async function recomputeUser(
	db: DomainDb,
	userId: string,
): Promise<void> {
	await db
		.update(users)
		.set({
			numberOfBooks: sql`(select count(*)::int from ${books} where ${books.userId} = ${userId})`,
		})
		.where(eq(users.userId, userId));
}

/** routers/items.py:update_book + crud.update_book
 *  null === Book not found
 *  既知バグ #3 修正済み: status も更新するようになった。 */
export async function updateBook(
	db: DomainDb,
	userId: string,
	bookId: string,
	input: {
		bookTitle: string;
		status: string;
		bookPages: number;
		updatedAt: Date;
	},
): Promise<BookRow | null> {
	const [updated] = await db
		.update(books)
		.set({
			bookTitle: input.bookTitle,
			status: input.status,
			bookPages: input.bookPages,
			updatedAt: input.updatedAt,
		})
		.where(and(eq(books.userId, userId), eq(books.bookId, bookId)))
		.returning();

	return updated ?? null;
}
