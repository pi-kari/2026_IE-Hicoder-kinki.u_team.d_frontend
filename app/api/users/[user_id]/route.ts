import { getUser, updateUserName } from "@/lib/domain/users";
import {
	intParam,
	jsonBody,
	userNotFound,
	withErrorHandling,
} from "@/lib/http";
import { UserNameUpdateBody } from "@/lib/requests";
import { toUserResponse } from "@/lib/serialize";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ user_id: string }> };

// routers/users.py:read_user + crud.get_user_public_info
export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
	const { user_id } = await ctx.params;
	const userId = intParam("user_id", user_id);
	if (!userId.ok) return userId.response;

	const user = await getUser(db, userId.value);
	if (!user) return userNotFound();

	return Response.json(toUserResponse(user));
});

// routers/users.py:update_user_name + crud.update_user_name
//
// 既知バグ #1 の再現: crud 側はユーザが存在しないと None を返し、router は
// それをそのまま返す。FastAPI は response_model=UserResponse の検証に失敗して
// ResponseValidationError を投げ、結果 500 になる。
// ここでも意図的に投げて withErrorHandling に 500 plain text を返させる。
// (修正は Phase 2)
export const PATCH = withErrorHandling(async (request: Request, ctx: Ctx) => {
	const { user_id } = await ctx.params;
	const userId = intParam("user_id", user_id);
	if (!userId.ok) return userId.response;

	const body = await jsonBody(request, UserNameUpdateBody);
	if (!body.ok) return body.response;

	const updated = await updateUserName(db, userId.value, body.data.username);
	if (!updated) {
		// 既知バグ #1 をそのまま再現するための意図的な 500。
		throw new Error(
			`update_user_name returned None for user_id=${userId.value} (parity with FastAPI ResponseValidationError)`,
		);
	}

	return Response.json(toUserResponse(updated));
});
