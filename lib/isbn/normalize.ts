/**
 * ISBN の正規化と、NDL の `dc:extent` からのページ数抽出。
 *
 * 純関数だけを置く。ブラウザ API にもサーバ専用モジュールにも触れないこと。
 * バーコードのスキャナ (クライアント) と NDL のパーサ (サーバ) の両方から使う。
 *
 * bunfig.toml の `[test] root = "lib"` により bun test が拾うのは lib/ 配下だけ。
 * テストしたいロジックはこの層に集める。
 */

/** EAN-13 のチェックディジット。先頭 12 桁から計算する。 */
function ean13CheckDigit(first12: string): number {
	let sum = 0;
	for (let i = 0; i < 12; i++) {
		// 奇数桁 (0-indexed で偶数) が 1 倍、偶数桁が 3 倍。
		sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
	}
	return (10 - (sum % 10)) % 10;
}

/** ISBN-10 のチェックディジット。先頭 9 桁から計算する。10 は "X"。 */
function isbn10CheckDigit(first9: string): string {
	let sum = 0;
	for (let i = 0; i < 9; i++) {
		sum += Number(first9[i]) * (10 - i);
	}
	const rest = (11 - (sum % 11)) % 11;
	return rest === 10 ? "X" : String(rest);
}

/**
 * ISBN を 13 桁に正規化する。受け付けられない値は null。
 *
 * ISBN-10 (ハイフン付き可) は 978 を前置してチェックディジットを振り直す。
 * NDL は同じ本の別の版を ISBN-10 のハイフン付きで返してくることがあるので、
 * 突き合わせのために必ずここを通す。
 *
 * **978/979 以外の EAN-13 は弾く。** 日本の書籍バーコードは 2 段組みで、
 * 下段は `192…` で始まる分類・価格コード (日本図書コード)。
 * これを弾かないと、バーコードを読ませたときに誤った値が登録される。
 */
export function normalizeIsbn(raw: string): string | null {
	// ハイフンは種類が多い (全角・ダッシュ類) のでまとめて落とす。
	const s = raw.replace(/[\s\-‐-―－]/g, "").toUpperCase();

	if (/^\d{9}[\dX]$/.test(s)) {
		if (isbn10CheckDigit(s.slice(0, 9)) !== s[9]) return null;
		const body = `978${s.slice(0, 9)}`;
		return `${body}${ean13CheckDigit(body)}`;
	}

	if (/^\d{13}$/.test(s)) {
		if (!/^97[89]/.test(s)) return null;
		if (ean13CheckDigit(s.slice(0, 12)) !== Number(s[12])) return null;
		return s;
	}

	return null;
}

/**
 * NDL の `dc:extent` からページ数を取り出す。取れなければ null。
 *
 * 実測した形: `237p` / `411p` / `188p` / `610p` / `xiv, 236p` / `237, 12p` /
 * `237p ; 21cm` / `1冊`。
 *
 * 「カンマ区切りの数列 + p」をすべて拾って最大値を採る。
 * - `xiv, 236p` のローマ数字の前書きは数字でないので自然に無視される
 * - `237, 12p` は本文 237 ページ + 索引 12 ページなので最大値が本文
 * - `1冊` のように p が無ければページ数不明として null (0 を返すと
 *   進捗率の分母が 0 になり、呼び出し側で「未取得」と区別できない)
 */
export function parseExtent(raw: string | null | undefined): number | null {
	if (!raw) return null;

	let best: number | null = null;
	for (const m of raw.matchAll(/(\d+(?:\s*,\s*\d+)*)\s*p/gi)) {
		for (const part of m[1].split(",")) {
			const n = Number(part.trim());
			if (Number.isFinite(n) && n > 0 && (best === null || n > best)) best = n;
		}
	}
	return best;
}
