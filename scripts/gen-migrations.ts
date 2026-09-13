#!/usr/bin/env bun
/**
 * ブラウザ側マイグレーションの .sql を TypeScript に焼き込む。
 *
 * なぜ import しないのか:
 * Next 16 の `turbopack.rules` に `{ "*.sql": { type: "raw" } }` を書いても
 * モジュールが解決されず、import した値が undefined になる (dev / build とも)。
 * バンドラの挙動に依存せず確実に文字列を持ち込むため、生成物をコミットする。
 *
 * 生成物と .sql がずれると、ブラウザのローカル DB だけ古いスキーマのまま
 * 黙って動き続ける。lib/local/migrations.test.ts がその一致を見張っている。
 */
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "lib/local/migrations.generated.ts";

// サーバのマイグレーションは drizzle の journal を正とする (手で足す必要がない)。
const journal = JSON.parse(
	readFileSync("drizzle/meta/_journal.json", "utf8"),
) as { entries: { tag: string }[] };

const sources = [
	...journal.entries.map((e) => ({
		tag: e.tag,
		path: `drizzle/${e.tag}.sql`,
	})),
	// ローカル専用テーブル。drizzle-kit には食わせないので手でここに足す。
	// **既存ファイルに追記するのではなく、必ず新しい連番を足すこと。**
	// 起動済みの端末は _local_migrations に tag を記録済みで、同じ tag の
	// ファイルは二度と実行されない。
	{ tag: "local_0000", path: "lib/local/0000_local.sql" },
	{ tag: "local_0001", path: "lib/local/0001_local.sql" },
];

const body = sources
	.map(({ tag, path }) => {
		const sql = readFileSync(path, "utf8");
		// テンプレートリテラルに入れるので、閉じる可能性のある文字だけ退避する。
		const escaped = sql
			.replace(/\\/g, "\\\\")
			.replace(/`/g, "\\`")
			.replace(/\$\{/g, "\\${");
		return `\t{\n\t\ttag: ${JSON.stringify(tag)},\n\t\tsql: \`${escaped}\`,\n\t},`;
	})
	.join("\n");

writeFileSync(
	OUT,
	`// scripts/gen-migrations.ts が生成。手で編集しない。
// 元ファイル: ${sources.map((s) => s.path).join(", ")}
export const MIGRATION_SQL: { tag: string; sql: string }[] = [
${body}
];
`,
);

console.log(`generated ${OUT} (${sources.length} migrations)`);
