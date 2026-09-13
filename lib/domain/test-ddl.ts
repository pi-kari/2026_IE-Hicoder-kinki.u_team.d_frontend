import { readFileSync } from "node:fs";

/**
 * テスト用のサーバスキーマ DDL。lib/domain/*.test.ts だけが使う。
 *
 * **journal を正とする。** 以前は 0000_equal_thena.sql を決め打ちで読んでいたが、
 * それだと列を足すマイグレーションを書いた瞬間に
 * 「本番には列があるのにテスト DB には無い」状態になり、
 * 原因の分かりにくい 42703 (column does not exist) で一斉に落ちる。
 * 実際に isbn 列を足したときそうなった。
 */
const root = `${import.meta.dir}/../..`;

const journal = JSON.parse(
	readFileSync(`${root}/drizzle/meta/_journal.json`, "utf8"),
) as { entries: { tag: string }[] };

export const SCHEMA_DDL = journal.entries
	.map((e) => readFileSync(`${root}/drizzle/${e.tag}.sql`, "utf8"))
	.join("\n");
