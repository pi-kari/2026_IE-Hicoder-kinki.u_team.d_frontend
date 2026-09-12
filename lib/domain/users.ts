import { eq } from "drizzle-orm";
import { users } from "../schema";
import type { DomainDb } from "./db";

type UserRow = typeof users.$inferSelect;

/** routers/users.py:create_user
 *
 * NOTE: username が重複すると unique 違反で throw する。呼び出し側はこれを
 * 捕まえず 500 にすること (FastAPI も IntegrityError 未処理で 500 だった)。 */
export async function createUser(
	db: DomainDb,
	input: { username: string; userMailAddress: string | null },
): Promise<UserRow> {
	const [created] = await db
		.insert(users)
		.values({
			username: input.username,
			userMailAddress: input.userMailAddress,
		})
		.returning();

	return created;
}

/** routers/users.py:read_user + crud.get_user_public_info
 *  null === User not found */
export async function getUser(
	db: DomainDb,
	userId: number,
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
 * 既知バグ #1: 呼び出し側 (PATCH /users/:id) は null を 404 にせず 500 を返す。
 * FastAPI の crud が None を返し、router がそれをそのまま返して
 * response_model 検証で ResponseValidationError になっていたのの再現。
 * 404 に直すのは Phase 2。 */
export async function updateUserName(
	db: DomainDb,
	userId: number,
	username: string,
): Promise<UserRow | null> {
	const [updated] = await db
		.update(users)
		.set({ username })
		.where(eq(users.userId, userId))
		.returning();

	return updated ?? null;
}
