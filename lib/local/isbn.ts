import { normalizeIsbn } from "../isbn/normalize";
import type { BookMeta } from "../isbn/types";
import { putCover } from "./covers";
import { ensureSessionFor } from "./sync";

/**
 * 端末側から ISBN の書誌を引く。
 *
 * NDL が CORS ヘッダを返さないので、必ず自前の /api/isbn を経由する
 * (lib/server/ndl.ts に経緯)。**つまりこの機能だけはオンラインが要る。**
 * オフラインでも本の登録自体は続けられるように、失敗を種類ごとに返して
 * 呼び出し側が案内を出し分けられるようにしている。
 */

export type IsbnLookup =
	/** 引けた。pages は取れないことがある (版によって dc:extent が無い)。 */
	| { kind: "ok"; meta: BookMeta }
	/** ISBN として読めない値。 */
	| { kind: "invalid" }
	/** ISBN は正しいが NDL にも openBD にも無い。 */
	| { kind: "not-found" }
	/** セッションを張れなかった。オフラインとは原因が違うので分ける。 */
	| { kind: "unauthorized" }
	/** ネットワークに出られない。 */
	| { kind: "offline" }
	/** サーバ側で落ちた。 */
	| { kind: "failed" };

export async function lookupIsbn(
	userId: string,
	raw: string,
): Promise<IsbnLookup> {
	const isbn = normalizeIsbn(raw);
	if (!isbn) return { kind: "invalid" };

	// /api/isbn は認証必須。ensureSession は普段 runSync の中でしか走らないので、
	// オフラインで登録した端末が初めてオンラインになった直後はまだ cookie が無い。
	try {
		await ensureSessionFor(userId);
	} catch {
		// ここで落ちてもセッションが既にあるかもしれないので、続けて試す。
	}

	let res: Response;
	try {
		res = await fetch(`/api/isbn/${isbn}`);
	} catch {
		return { kind: "offline" };
	}

	if (res.status === 404) return { kind: "not-found" };
	if (res.status === 401 || res.status === 403) return { kind: "unauthorized" };
	if (res.status === 422) return { kind: "invalid" };
	if (!res.ok) return { kind: "failed" };

	let meta: BookMeta;
	try {
		meta = (await res.json()) as BookMeta;
	} catch {
		return { kind: "failed" };
	}

	// 表紙は端末内に置く。同期はしない (ISBN があれば引き直せる)。
	if (meta.cover) {
		try {
			await putCover(meta.isbn, meta.cover);
		} catch (error) {
			// 表紙が保存できなくても登録は続けられる。握りつぶさずに残す。
			console.error(error);
		}
	}

	return { kind: "ok", meta };
}
