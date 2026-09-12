import { getUser, updateUserName } from "@/lib/domain/users";
import {
	jsonBody,
	userNotFound,
	uuidParam,
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
	const userId = uuidParam("user_id", user_id);
	if (!userId.ok) return userId.response;

	const user = await getUser(db, userId.value);
	if (!user) return userNotFound();

	return Response.json(toUserResponse(user));
});

// routers/users.py:update_user_name + crud.update_user_name
// 既知バグ #1 修正済み: 存在しないユーザーは 500 ではなく 404 を返す。
export const PATCH = withErrorHandling(async (request: Request, ctx: Ctx) => {
	const { user_id } = await ctx.params;
	const userId = uuidParam("user_id", user_id);
	if (!userId.ok) return userId.response;

	const body = await jsonBody(request, UserNameUpdateBody);
	if (!body.ok) return body.response;

	const updated = await updateUserName(
		db,
		userId.value,
		body.data.username,
		new Date(),
	);
	if (!updated) return userNotFound();

	return Response.json(toUserResponse(updated));
});
