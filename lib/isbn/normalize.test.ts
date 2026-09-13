import { expect, test } from "bun:test";
import { normalizeIsbn, parseExtent } from "./normalize";

test("13 桁の ISBN はそのまま通る", () => {
	expect(normalizeIsbn("9784873115658")).toBe("9784873115658");
	expect(normalizeIsbn("9784297127473")).toBe("9784297127473");
	// 979 (新しい出版者記号) も書籍。
	expect(normalizeIsbn("9791234567896")).toBe("9791234567896");
});

test("ハイフンと空白は無視する", () => {
	expect(normalizeIsbn("978-4-87311-565-8")).toBe("9784873115658");
	expect(normalizeIsbn(" 978 4 87311 565 8 ")).toBe("9784873115658");
	// 全角ハイフンやダッシュ類で書かれていても拾う。
	expect(normalizeIsbn("978－4－87311－565－8")).toBe("9784873115658");
});

test("ISBN-10 は 978 を前置してチェックディジットを振り直す", () => {
	// NDL は同じ本の別の版を ISBN-10 のハイフン付きで返してくる。
	expect(normalizeIsbn("4-10-101001-3")).toBe("9784101010014");
	expect(normalizeIsbn("4101010013")).toBe("9784101010014");
	// 末尾が X の ISBN-10 (人月の神話 0-201-61622-X)。
	expect(normalizeIsbn("0-201-61622-X")).toBe("9780201616224");
});

test("チェックディジットが合わない値は拒否する", () => {
	// 末尾を 1 つずらしただけ。
	expect(normalizeIsbn("9784873115659")).toBeNull();
	expect(normalizeIsbn("4-10-101001-4")).toBeNull();
});

test("日本の書籍バーコード下段 (192…) を拒否する", () => {
	// 本の裏は 2 段組みで、下段は分類・価格コード。これを本の ISBN として
	// 受けてしまうと、スキャン時に誤った本が登録される。
	// チェックディジットは正しい値を使う。そうしないと「桁が壊れているから
	// 落ちた」のか「接頭辞で弾けた」のか区別がつかず、テストが意味を失う。
	expect(normalizeIsbn("1920079009003")).toBeNull();
	// 978/979 以外は一律で弾く。
	expect(normalizeIsbn("4912345678904")).toBeNull();
});

test("桁数が合わない値は拒否する", () => {
	expect(normalizeIsbn("")).toBeNull();
	expect(normalizeIsbn("978487311565")).toBeNull(); // 12 桁
	expect(normalizeIsbn("97848731156588")).toBeNull(); // 14 桁
	expect(normalizeIsbn("リーダブルコード")).toBeNull();
});

test("dc:extent からページ数を取り出す (実データの形)", () => {
	expect(parseExtent("237p")).toBe(237);
	expect(parseExtent("411p")).toBe(411);
	expect(parseExtent("188p")).toBe(188);
	expect(parseExtent("610p")).toBe(610);
	// ローマ数字の前書きは無視する。
	expect(parseExtent("xiv, 236p")).toBe(236);
	// 本文 + 索引。大きい方が本文。
	expect(parseExtent("237, 12p")).toBe(237);
	// 判型が続く形。
	expect(parseExtent("237p ; 21cm")).toBe(237);
	expect(parseExtent("xiv, 236 p. ; 24cm")).toBe(236);
	// 図版が別立てになっている形。
	expect(parseExtent("605p 図版12p")).toBe(605);
});

test("ページ数が書かれていない extent は null", () => {
	// 0 を返すと進捗率の分母が 0 になり、「未取得」と区別できなくなる。
	expect(parseExtent("1冊")).toBeNull();
	expect(parseExtent("2冊 ; 21cm")).toBeNull();
	expect(parseExtent("")).toBeNull();
	expect(parseExtent(null)).toBeNull();
	expect(parseExtent(undefined)).toBeNull();
});
