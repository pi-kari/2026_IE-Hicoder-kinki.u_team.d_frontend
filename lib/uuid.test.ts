import { expect, test } from "bun:test";
import { isUuid, uuidv7 } from "./uuid";

test("形式が UUID で version 7 / variant 10xx", () => {
	for (let i = 0; i < 100; i++) {
		const id = uuidv7();
		expect(isUuid(id)).toBe(true);
		expect(id[14]).toBe("7");
		expect("89ab").toContain(id[19]);
	}
});

test("連続生成が厳密に単調増加する (同一ミリ秒でも)", () => {
	const ids = Array.from({ length: 5000 }, () => uuidv7());
	const sorted = [...ids].sort();
	expect(ids).toEqual(sorted);
	expect(new Set(ids).size).toBe(ids.length);
});

test("先頭 48bit が生成時刻を表す", () => {
	const before = Date.now();
	const id = uuidv7();
	const ms = Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
	expect(ms).toBeGreaterThanOrEqual(before);
	expect(ms).toBeLessThanOrEqual(Date.now());
});

test("isUuid は形式違いを弾く", () => {
	expect(isUuid("5")).toBe(false);
	expect(isUuid("not-a-uuid")).toBe(false);
	expect(isUuid("")).toBe(false);
});
