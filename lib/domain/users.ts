import { eq } from "drizzle-orm";
import { users } from "../schema";
import type { DomainDb } from "./db";

type UserRow = typeof users.$inferSelect;

/** routers/users.py:create_user
 *
 * userId / updatedAt は呼び出し側が渡す。サーバに採番も打刻もさせない
 * (理由は lib/domain/db.ts のコメント)。 */
export async function createUser(
	db: DomainDb,
	input: {
		userId: string;
		username: string;
		userMailAddress: string | null;
		updatedAt: Date;
	},
): Promise<UserRow> {
	const [created] = await db
		.insert(users)
		.values({
			userId: input.userId,
			username: input.username,
			userMailAddress: input.userMailAddress,
			updatedAt: input.updatedAt,
		})
		.returning();

	return created;
}

/** routers/users.py:read_user + crud.get_user_public_info
 *  null === User not found */
export async function getUser(
	db: DomainDb,
	userId: string,
): Promise<Pick<UserRow, "userId" | "username" | "numberOfBooks"> | null> {
	const [user] = await db
		.select({
			userId: users.userId,
			username: users.username,
			numberOfBooks: users.numberOfBooks,
		})
		.from(users)
		.where(eq(users.userId, userId))
		.limit(1);

	return user ?? null;
}

/** routers/users.py:update_user_name + crud.update_user_name
 *  null === User not found
 *
 * 既知バグ #1 修正済み: 以前は存在しないユーザーで 500 になっていた
 * (FastAPI の crud が None を返し response_model 検証で落ちていたのの再現)。
 * 今は呼び出し側が素直に 404 を返す。 */
export async function updateUserName(
	db: DomainDb,
	userId: string,
	username: string,
	updatedAt: Date,
): Promise<UserRow | null> {
	const [updated] = await db
		.update(users)
		.set({ username, updatedAt })
		.where(eq(users.userId, userId))
		.returning();

	return updated ?? null;
}
