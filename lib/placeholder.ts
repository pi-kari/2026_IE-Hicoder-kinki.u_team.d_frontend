/**
 * 本の表紙のプレースホルダ。
 *
 * 以前は placehold.co / picsum.photos という外部 URL を使っていたが、
 * オフラインでは当然読めず、**まさにオフラインで確認したい画面だけ
 * 画像が壊れて見える**ことになる。データ URI にして自己完結させた。
 * 追加のネットワークもキャッシュ設定も要らない。
 */

const PALETTE = [
	["#3f9a52", "#e8f3ea"],
	["#8b5e3c", "#f3ece5"],
	["#3b6ea5", "#e7eef6"],
	["#a55b8b", "#f6e9f1"],
	["#a5893b", "#f6f1e4"],
] as const;

/** 文字列から決定的に色を選ぶ (同じ本はいつも同じ色になる)。 */
function pick(seed: string) {
	let h = 0;
	for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
	return PALETTE[Math.abs(h) % PALETTE.length];
}

/** 本の表紙。タイトルの 1 文字目を大きく置いただけの SVG。 */
export function bookCover(seed: string, label: string): string {
	const [fg, bg] = pick(seed);
	const initial = [...label.trim()][0] ?? "本";
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" viewBox="0 0 200 280">
<rect width="200" height="280" fill="${bg}"/>
<rect x="0" y="0" width="10" height="280" fill="${fg}"/>
<text x="112" y="160" font-family="sans-serif" font-size="96" font-weight="700" fill="${fg}" text-anchor="middle">${escapeXml(initial)}</text>
</svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** プロフィールのアバター。 */
export function avatar(seed: string): string {
	const [fg, bg] = pick(seed);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
<rect width="200" height="200" fill="${bg}"/>
<circle cx="100" cy="78" r="36" fill="${fg}"/>
<path d="M28 200c0-40 32-66 72-66s72 26 72 66z" fill="${fg}"/>
</svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
	return s.replace(
		/[<>&"']/g,
		(c) =>
			({
				"<": "&lt;",
				">": "&gt;",
				"&": "&amp;",
				'"': "&quot;",
				"'": "&apos;",
			})[c] as string,
	);
}
