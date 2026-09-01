import { db } from "@/lib/db";
import { jsonBody, withErrorHandling } from "@/lib/http";
import { UserCreateBody } from "@/lib/requests";
import { users } from "@/lib/schema";
import { toUserResponse } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// routers/users.py:create_user の移植。
// PUT で「作成」なのは現行 API の契約なのでそのまま維持する。
//
// NOTE: username が重複すると unique 違反で例外 → withErrorHandling が 500 を返す。
// これは FastAPI (IntegrityError が未処理で 500) と同じ挙動。
export const PUT = withErrorHandling(async (request: Request) => {
	const body = await jsonBody(request, UserCreateBody);
	if (!body.ok) return body.response;

	const [created] = await db
		.insert(users)
		.values({
			username: body.data.username,
			userMailAddress: body.data.user_mail_address ?? null,
		})
		.returning();

	return Response.json(toUserResponse(created));
});
