import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	intParam,
	jsonBody,
	userNotFound,
	withErrorHandling,
} from "@/lib/http";
import { UserNameUpdateBody } from "@/lib/requests";
import { users } from "@/lib/schema";
import { toUserResponse } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ user_id: string }> };

// routers/users.py:read_user + crud.get_user_public_info
export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
	const { user_id } = await ctx.params;
	const userId = intParam("user_id", user_id);
	if (!userId.ok) return userId.response;

	const [user] = await db
		.select({
			userId: users.userId,
			username: users.username,
			numberOfBooks: users.numberOfBooks,
		})
		.from(users)
		.where(eq(users.userId, userId.value))
		.limit(1);

	if (!user) return userNotFound();

	return Response.json(toUserResponse(user));
});

// routers/users.py:update_user_name + crud.update_user_name
//
// 既知バグ #1 の再現: crud 側はユーザが存在しないと None を返し、router は
// それをそのまま返す。FastAPI は response_model=UserResponse の検証に失敗して
// ResponseValidationError を投げ、結果 500 になる。
// ここでも意図的に投げて withErrorHandling に 500 plain text を返させる。
// (修正は Phase 3)
export const PATCH = withErrorHandling(async (request: Request, ctx: Ctx) => {
	const { user_id } = await ctx.params;
	const userId = intParam("user_id", user_id);
	if (!userId.ok) return userId.response;

	const body = await jsonBody(request, UserNameUpdateBody);
	if (!body.ok) return body.response;

	const [updated] = await db
		.update(users)
		.set({ username: body.data.username })
		.where(eq(users.userId, userId.value))
		.returning();

	if (!updated) {
		// 既知バグ #1 をそのまま再現するための意図的な 500。
		throw new Error(
			`update_user_name returned None for user_id=${userId.value} (parity with FastAPI ResponseValidationError)`,
		);
	}

	return Response.json(toUserResponse(updated));
});
