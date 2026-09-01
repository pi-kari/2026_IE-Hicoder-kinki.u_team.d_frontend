import {
	BookResponseSchema,
	ProgressResponseSchema,
	ProgressUpdateResponseSchema,
	ResponseTreeStateSchema,
	TodayProgressResponseSchema,
	UserResponseSchema,
} from "./contract";
import type { books, progress, users } from "./schema";

// FastAPI の response_model 相当。zod v4 の object スキーマは未知キーを strip するので、
// Drizzle の select が余分に返す列 (books_list.user_id など) がここで落ちる。
// 各ハンドラは必ずこれらを経由して返すこと。

type UserRow = typeof users.$inferSelect;
type BookRow = typeof books.$inferSelect;
type ProgressRow = typeof progress.$inferSelect;

/** schemas.UserResponse */
export function toUserResponse(
	row: Pick<UserRow, "userId" | "username" | "numberOfBooks">,
) {
	return UserResponseSchema.parse({
		user_id: row.userId,
		username: row.username,
		number_of_books: row.numberOfBooks,
	});
}

/** schemas.BookResponse */
export function toBookResponse(row: BookRow) {
	return BookResponseSchema.parse({
		book_id: row.bookId,
		status: row.status,
		book_title: row.bookTitle,
		book_pages: row.bookPages,
		total_progress: row.totalProgress,
		tree_ratio: row.treeRatio,
		tree_state: row.treeState,
	});
}

/** schemas.ProgressResponse
 *  created_at は timestamptz なので pg が Date を返す。ReadingHistorySchema.date は
 *  z.string() なので、必ず toISOString() を通してから parse すること。 */
export function toProgressResponse(
	totalProgress: number,
	history: Pick<ProgressRow, "createdAt" | "progress">[],
) {
	return ProgressResponseSchema.parse({
		total_progress: totalProgress,
		history: history.map((row) => ({
			date: row.createdAt.toISOString(),
			progress: row.progress,
		})),
	});
}

/** schemas.TodayProgressResponse */
export function toTodayProgressResponse(value: number) {
	return TodayProgressResponseSchema.parse({ progress: value });
}

/** schemas.ProgressUpdateResponse */
export function toProgressUpdateResponse(row: {
	totalProgress: number;
	treeRatio: number;
	treeState: number;
}) {
	return ProgressUpdateResponseSchema.parse({
		total_progress: row.totalProgress,
		tree_ratio: row.treeRatio,
		tree_state: row.treeState,
	});
}

/** schemas.ResponseTreeState */
export function toTreeStateResponse(row: {
	treeRatio: number;
	treeState: number;
}) {
	return ResponseTreeStateSchema.parse({
		tree_ratio: row.treeRatio,
		tree_state: row.treeState,
	});
}
