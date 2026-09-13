import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseNdlOpenSearch } from "./ndl";

/**
 * フィクスチャは NDL から実際に取得した XML をそのまま置いている。
 * 手で整形すると「実物では起きない形」をテストしてしまうので触らない。
 */
function fixture(isbn: string): string {
	return readFileSync(`${import.meta.dir}/fixtures/${isbn}.xml`, "utf8");
}

test("item が 1 件だけでも読める (isArray 設定が効いていること)", () => {
	// fast-xml-parser は既定だと 1 件をオブジェクトで返し、配列前提のループが壊れる。
	const meta = parseNdlOpenSearch(fixture("9784873115658"), "9784873115658");
	expect(meta).not.toBeNull();
	expect(meta?.title).toBe(
		"リーダブルコード : より良いコードを書くためのシンプルで実践的なテクニック",
	);
	expect(meta?.pages).toBe(237);
	expect(meta?.publisher).toBe("オライリー・ジャパン");
	expect(meta?.author).toContain("Boswell, Dustin");
	// 表紙はこの層では取らない (fetch は lib/server/ndl.ts の仕事)。
	expect(meta?.cover).toBeNull();
});

test("巻数は書名につなげる (本棚で同名が並ばないように)", () => {
	const meta = parseNdlOpenSearch(fixture("9784088832296"), "9784088832296");
	expect(meta?.title).toBe("ドロンドロロン 3");
	expect(meta?.pages).toBe(188);
	expect(meta?.publisher).toBe("集英社");
});

test("複数 item のうちページ数を持つものを選ぶ", () => {
	// 「吾輩は猫である」は版違いで 4 件返り、dc:extent を持つのは 4 件目だけ。
	// しかもその item の ISBN は ISBN-10 のハイフン付き ("4-10-101001-3") なので、
	// 正規化せずに突き合わせるとページ数を取り逃す。
	const meta = parseNdlOpenSearch(fixture("9784101010014"), "9784101010014");
	expect(meta?.title).toBe("吾輩は猫である");
	expect(meta?.pages).toBe(610);
	// 要求された ISBN をそのまま返す (選ばれた item の表記ではなく)。
	expect(meta?.isbn).toBe("9784101010014");
});

test("0 件のレスポンスは null", () => {
	expect(
		parseNdlOpenSearch(fixture("9789999999999"), "9789999999999"),
	).toBeNull();
});

test("壊れた入力でも例外を投げない", () => {
	// ネットワークの途中で切れた応答が来ても、呼び出し側は 404 として扱えればよい。
	expect(parseNdlOpenSearch("", "9784873115658")).toBeNull();
	expect(
		parseNdlOpenSearch("<rss><channel></channel></rss>", "9784873115658"),
	).toBeNull();
});
