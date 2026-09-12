import { z } from "zod";
import { jsonBody, withErrorHandling } from "@/lib/http";
import { redeemTransferCode } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const RedeemBody = z.object({ code: z.string().min(4).max(40) });

/**
 * 引き継ぎコードでこの端末にセッションを張る。
 * コードは 1 回きりで 10 分で失効する。
 */
export const POST = withErrorHandling(async (request: Request) => {
	const body = await jsonBody(request, RedeemBody);
	if (!body.ok) return body.response;

	const result = await redeemTransferCode(body.data.code);
	if (!result.ok) return result.response;

	return Response.json(
		{ user_id: result.userId },
		{ headers: { "set-cookie": result.cookie } },
	);
});
