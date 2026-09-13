import "server-only";

import { type BookMeta, parseNdlOpenSearch } from "../isbn/ndl";

/**
 * ISBN から書誌を引く。サーバ側でしか動かせない。
 *
 * **なぜサーバを経由するのか:** NDL は CORS ヘッダを返さないのでブラウザから
 * 直接は読めない。それでも NDL が必要なのは、実測した限り
 * **ページ数 (`dc:extent`) を返すのが NDL だけ**だから。進捗率の分母に
 * ページ数が要るので、ここは避けて通れない。
 *
 * - openBD: CORS は通るが、試した 7 冊すべてで `Extent: null` / `cover` 空。
 *   NDL が 0 件のときの書名フォールバックとしてだけ使う。
 * - Google Books: キー無しだと共有プロジェクトの枠で 429 になった。使わない。
 *
 * パース本体は lib/isbn/ndl.ts にある (このファイルは `server-only` を
 * import しているので bun test から読めない)。
 */

const NDL_ORIGIN = "https://ndlsearch.ndl.go.jp";
const OPENBD_URL = "https://api.openbd.jp/v1/get";

/** 書誌はほぼ変わらないので 1 日キャッシュする。 */
const REVALIDATE_SECONDS = 86_400;

/**
 * 表紙の上限。実測では 6〜14KB だった。
 * 端末内 DB にそのまま入れるので、想定外に大きいものは捨てる。
 */
const MAX_COVER_BYTES = 512 * 1024;

async function fetchNdl(isbn13: string): Promise<BookMeta | null> {
	const res = await fetch(`${NDL_ORIGIN}/api/opensearch?isbn=${isbn13}`, {
		next: { revalidate: REVALIDATE_SECONDS },
	});
	if (!res.ok) return null;
	return parseNdlOpenSearch(await res.text(), isbn13);
}

/**
 * 表紙を data URI にして返す。取れなければ null (失敗させない)。
 *
 * **`Referer` が無いと 403 になる。** User-Agent は関係なかった
 * (Referer だけ付けて 200、UA だけ付けて 403、と切り分け済み)。
 *
 * data URI にするのは、外部 URL をそのまま UI に渡すとオフラインで
 * 表紙だけ壊れて見えるため。lib/placeholder.ts と同じ判断。
 */
async function fetchCover(isbn13: string): Promise<string | null> {
	const res = await fetch(`${NDL_ORIGIN}/thumbnail/${isbn13}.jpg`, {
		headers: { Referer: `${NDL_ORIGIN}/` },
		next: { revalidate: REVALIDATE_SECONDS },
	});
	if (!res.ok) return null;

	const type = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
	if (!type.startsWith("image/")) return null;

	const buf = Buffer.from(await res.arrayBuffer());
	if (buf.byteLength === 0 || buf.byteLength > MAX_COVER_BYTES) return null;

	return `data:${type};base64,${buf.toString("base64")}`;
}

type OpenBdEntry = {
	summary?: { title?: string; publisher?: string; author?: string };
} | null;

/** NDL が 0 件だったときだけの保険。新刊で NDL 未収録のものを拾う。 */
async function fetchOpenBd(isbn13: string): Promise<BookMeta | null> {
	const res = await fetch(`${OPENBD_URL}?isbn=${isbn13}`, {
		next: { revalidate: REVALIDATE_SECONDS },
	});
	if (!res.ok) return null;

	const json = (await res.json()) as OpenBdEntry[];
	const summary = json?.[0]?.summary;
	if (!summary?.title) return null;

	return {
		isbn: isbn13,
		title: summary.title,
		// openBD はページ数を持っていない (実測)。呼び出し側で手入力させる。
		pages: null,
		publisher: summary.publisher || null,
		author: summary.author || null,
		cover: null,
	};
}

/** 13 桁に正規化済みの ISBN で引く。見つからなければ null。 */
export async function lookupIsbn(isbn13: string): Promise<BookMeta | null> {
	// 表紙は書誌と独立に取れるので並列にする。片方が落ちても他方は返す。
	const [ndl, cover] = await Promise.all([
		fetchNdl(isbn13).catch(() => null),
		fetchCover(isbn13).catch(() => null),
	]);

	const meta = ndl ?? (await fetchOpenBd(isbn13).catch(() => null));
	if (!meta) return null;

	return { ...meta, cover };
}

export type { BookMeta };
