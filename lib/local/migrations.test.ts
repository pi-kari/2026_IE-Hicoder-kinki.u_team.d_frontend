import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { MIGRATION_SQL } from "./migrations.generated";

/**
 * ブラウザ側のマイグレーションは scripts/gen-migrations.ts が .sql から
 * TypeScript に焼き込む (Turbopack の raw import が効かないため)。
 * 生成物と .sql がずれると、ローカル DB だけ古いスキーマのまま
 * 黙って動き続けるので、ここで一致を見張る。
 */
const root = `${import.meta.dir}/../..`;
const journal = JSON.parse(
	readFileSync(`${root}/drizzle/meta/_journal.json`, "utf8"),
) as { entries: { tag: string }[] };

test("drizzle のマイグレーションが漏れなくブラウザ側にも載っている", () => {
	const serverTags = journal.entries.map((e) => e.tag);
	const listed = MIGRATION_SQL.map((m) => m.tag).filter(
		(t) => !t.startsWith("local_"),
	);
	expect(listed).toEqual(serverTags);
});

test("焼き込んだ SQL が元の .sql と一致する (再生成漏れの検出)", () => {
	for (const m of MIGRATION_SQL) {
		const path = m.tag.startsWith("local_")
			? `${root}/lib/local/0000_local.sql`
			: `${root}/drizzle/${m.tag}.sql`;
		expect(m.sql).toBe(readFileSync(path, "utf8"));
	}
});

test("ローカル専用テーブルはサーバのマイグレーションに含まれない", () => {
	// outbox がサーバ側に作られると、同期先の DB に要らないテーブルが増える
	for (const e of journal.entries) {
		expect(readFileSync(`${root}/drizzle/${e.tag}.sql`, "utf8")).not.toContain(
			"outbox",
		);
	}
});

test("ローカル側には outbox がある", () => {
	const local = MIGRATION_SQL.find((m) => m.tag === "local_0000");
	expect(local?.sql).toContain("CREATE TABLE IF NOT EXISTS outbox");
});
