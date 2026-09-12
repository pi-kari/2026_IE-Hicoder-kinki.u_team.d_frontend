import { z } from "zod";
import { jsonBody, withErrorHandling } from "@/lib/http";
import { claim } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const ClaimBody = z.object({
	user_id: z.uuid(),
	// 端末が登録時に作る 256bit の乱数 (base64url)
	secret: z.string().min(32).max(200),
});

/**
 * 端末の秘密で user_id を確保し、セッション cookie を張る。
 *
 * 登録はオフラインでも行えるようにしてあるので、秘密は端末が作る。
 * この API は端末が初めてオンラインになったときに呼ばれ、先着がその
 * user_id の所有者になる。user_id は端末内で生成され確保するまで
 * ネットワークに出ないので、先回りされることはない。
 */
export const POST = withErrorHandling(async (request: Request) => {
	const body = await jsonBody(request, ClaimBody);
	if (!body.ok) return body.response;

	const result = await claim(body.data.user_id, body.data.secret);
	if (!result.ok) return result.response;

	return Response.json(
		{ user_id: body.data.user_id },
		{ headers: { "set-cookie": result.cookie } },
	);
});
