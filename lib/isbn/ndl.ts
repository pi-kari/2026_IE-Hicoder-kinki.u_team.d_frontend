/**
 * 国立国会図書館サーチ OpenSearch のレスポンス (RSS 2.0) を読む。
 *
 * ここは純粋なパースだけ。fetch は lib/server/ndl.ts にある
 * (`server-only` を import したモジュールは bun test から読めないため、
 *  テストしたい部分をこちら側に置いている)。
 *
 * NDL を使う理由: **ページ数を返すのはここだけ**だった。
 * openBD は試した 7 冊すべてで `Extent: null` かつ `cover` 空、
 * Google Books はキー無しだと共有枠で 429 になる。
 * 進捗率の分母にページ数が必要なので、NDL が実質必須。
 */
import { XMLParser } from "fast-xml-parser";
import { normalizeIsbn, parseExtent } from "./normalize";
import type { BookMeta } from "./types";

export type { BookMeta };

/**
 * 1 件しか無いときオブジェクトで返ってくるとループが壊れるので、
 * 繰り返しうるタグは常に配列にする。
 */
const ALWAYS_ARRAY = new Set([
	"item",
	"dc:identifier",
	"dc:creator",
	"dc:publisher",
	"dc:title",
]);

const parser = new XMLParser({
	// dc:identifier の xsi:type="dcndl:ISBN" を読む必要がある。
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	isArray: (name) => ALWAYS_ARRAY.has(name),
	// 巻数 "3" が数値化されると型が揺れるので、値は文字列のまま扱う。
	parseTagValue: false,
	parseAttributeValue: false,
	trimValues: true,
});

type Node = Record<string, unknown>;

/** タグの値を文字列の配列にする。属性付きタグは `#text` に本文が入る。 */
function texts(value: unknown): string[] {
	if (value === undefined || value === null) return [];
	const arr = Array.isArray(value) ? value : [value];
	const out: string[] = [];
	for (const v of arr) {
		const raw = typeof v === "object" && v !== null ? (v as Node)["#text"] : v;
		if (raw === undefined || raw === null) continue;
		const s = String(raw).trim();
		if (s.length > 0) out.push(s);
	}
	return out;
}

/** その item が持つ ISBN を 13 桁に正規化して返す。 */
function isbnsOf(item: Node): string[] {
	const raw = item["dc:identifier"];
	const arr = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
	const out: string[] = [];
	for (const v of arr) {
		if (typeof v !== "object" || v === null) continue;
		const type = String((v as Node)["@_xsi:type"] ?? "");
		if (!type.endsWith("ISBN")) continue;
		// NDL は ISBN-10 のハイフン付き ("4-10-101001-3") でも返してくるので、
		// 必ず正規化してから突き合わせる。
		const isbn = normalizeIsbn(String((v as Node)["#text"] ?? ""));
		if (isbn) out.push(isbn);
	}
	return out;
}

function pagesOf(item: Node): number | null {
	for (const s of texts(item["dc:extent"])) {
		const n = parseExtent(s);
		if (n !== null) return n;
	}
	return null;
}

/**
 * OpenSearch の XML から 1 冊の書誌を選んで返す。0 件なら null。
 *
 * **同じ ISBN で複数の item が返る。** 例えば「吾輩は猫である」は版違いで 4 件
 * 返り、`dc:extent` を持つのは 4 件目だけ、しかもその item の ISBN は
 * ISBN-10 のハイフン付き表記だった。つまり
 * 「ISBN が一致する最初の item」を採るとページ数を取り逃す。
 *
 * 優先順位:
 *   1. ISBN が一致し、かつページ数がある
 *   2. ページ数がある
 *   3. 先頭 (ページ数は諦めて書名だけでも返す)
 */
export function parseNdlOpenSearch(
	xml: string,
	isbn13: string,
): BookMeta | null {
	const doc = parser.parse(xml) as Node;
	const rss = doc.rss as Node | undefined;
	const channel = rss?.channel as Node | undefined;
	const items = (channel?.item ?? []) as Node[];
	if (items.length === 0) return null;

	const withPages = items.filter((it) => pagesOf(it) !== null);
	const chosen =
		withPages.find((it) => isbnsOf(it).includes(isbn13)) ??
		withPages[0] ??
		items[0];

	const title = texts(chosen["dc:title"])[0];
	if (!title) return null;

	// 漫画やシリーズは巻数が別タグで来る ("ドロンドロロン" + "3")。
	// つなげないと本棚で同じ名前が並んで区別できない。
	const volume = texts(chosen["dcndl:volume"])[0];
	const creators = texts(chosen["dc:creator"]);

	return {
		isbn: isbn13,
		title: volume ? `${title} ${volume}` : title,
		pages: pagesOf(chosen),
		publisher: texts(chosen["dc:publisher"])[0] ?? null,
		author: creators.length > 0 ? creators.join(", ") : null,
		cover: null,
	};
}
