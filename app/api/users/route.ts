import { createUser } from "@/lib/domain/users";
import { jsonBody, withErrorHandling } from "@/lib/http";
import { UserCreateBody } from "@/lib/requests";
import { toUserResponse } from "@/lib/serialize";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

// routers/users.py:create_user の移植。
// PUT で「作成」なのは現行 API の契約なのでそのまま維持する。
//
// user_id はボディで受け取る。クライアント (オフラインの端末を含む) が
// uuidv7 を生成する契約なので、サーバは採番しない。
export const PUT = withErrorHandling(async (request: Request) => {
	const body = await jsonBody(request, UserCreateBody);
	if (!body.ok) return body.response;

	const created = await createUser(db, {
		userId: body.data.user_id,
		username: body.data.username,
		userMailAddress: body.data.user_mail_address ?? null,
		updatedAt: new Date(),
	});

	return Response.json(toUserResponse(created));
});
