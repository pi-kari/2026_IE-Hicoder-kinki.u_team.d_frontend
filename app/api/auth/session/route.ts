import { withErrorHandling } from "@/lib/http";
import { endSession, sessionUserId } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** いまのセッションの持ち主。未ログインなら user_id は null。 */
export const GET = withErrorHandling(async (request: Request) => {
	return Response.json({ user_id: await sessionUserId(request) });
});

/** この端末のセッションだけ破棄する (他の端末は残る)。 */
export const DELETE = withErrorHandling(async (request: Request) => {
	const cookie = await endSession(request);
	return Response.json({ ok: true }, { headers: { "set-cookie": cookie } });
});
