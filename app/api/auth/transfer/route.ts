import { withErrorHandling } from "@/lib/http";
import { issueTransferCode, requireSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** 2 台目を合流させるための短命コードを発行する。ログイン済みの端末だけが呼べる。 */
export const POST = withErrorHandling(async (request: Request) => {
	const session = await requireSession(request);
	if (!session.ok) return session.response;

	const { code, expiresAt } = await issueTransferCode(session.userId);

	return Response.json({ code, expires_at: expiresAt.toISOString() });
});
