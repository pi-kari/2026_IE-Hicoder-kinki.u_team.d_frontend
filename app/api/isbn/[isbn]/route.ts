import { errorJson, unprocessable, withErrorHandling } from "@/lib/http";
import { normalizeIsbn } from "@/lib/isbn/normalize";
import { requireSession } from "@/lib/server/auth";
import { lookupIsbn } from "@/lib/server/ndl";

/**
 * ISBN から書誌を引く。
 *
 * NDL が CORS ヘッダを返さないので、ブラウザから直接は叩けない。
 * ここが唯一の経路になる (lib/server/ndl.ts に理由を書いた)。
 *
 * `dynamic = "force-dynamic"` は**付けない**。requireSession が cookie を
 * 読むのでどのみち動的になるうえ、Next のバージョンによっては force-dynamic が
 * fetchCache を no-store にして、lib/server/ndl.ts の revalidate を黙って
 * 無効化する。
 */

type Ctx = { params: Promise<{ isbn: string }> };

export const GET = withErrorHandling(async (request: Request, ctx: Ctx) => {
	// 認証を通す。通さないと誰でも叩ける NDL のプロキシになってしまう。
	const session = await requireSession(request);
	if (!session.ok) return session.response;

	const { isbn: raw } = await ctx.params;
	const isbn = normalizeIsbn(decodeURIComponent(raw));
	if (!isbn) {
		return unprocessable([
			{
				loc: ["path", "isbn"],
				msg: "Input should be a valid ISBN-10 or ISBN-13",
				type: "isbn_parsing",
			},
		]);
	}

	const meta = await lookupIsbn(isbn);
	if (!meta) return errorJson("Book not found", 404);

	// セッション単位の応答なので private。表紙込みで数十 KB になるため、
	// 同じ本を続けて読んだときに再取得しないようにしておく。
	return Response.json(meta, {
		headers: { "Cache-Control": "private, max-age=86400" },
	});
});
