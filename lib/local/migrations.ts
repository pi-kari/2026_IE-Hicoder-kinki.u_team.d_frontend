import type { PGlite } from "@electric-sql/pglite";
import { MIGRATION_SQL } from "./migrations.generated";

/**
 * ブラウザの PGlite に流すマイグレーション。
 *
 * `drizzle-orm/pglite/migrator` は使えない。`drizzle-orm/migrator.js` が
 * `node:fs` と `node:crypto` を import しているため (実物を読んで確認)。
 * 代わりに SQL を文字列として持ち込み `exec()` に流す。
 * drizzle が吐く `--> statement-breakpoint` は SQL コメントで、`exec()` は
 * 複数文に対応しているので、ファイルを丸ごと投げられる (分割は不要)。
 *
 * 文字列は scripts/gen-migrations.ts が .sql から生成する。
 * Next 16 の turbopack.rules に `{"*.sql": {type:"raw"}}` を書いても
 * モジュールが解決されず undefined になったので、バンドラには頼らない。
 */
export const MIGRATIONS = MIGRATION_SQL;

/**
 * 破壊的なスキーマ変更用の世代番号。
 *
 * 追加だけのマイグレーションは上の配列と `_local_migrations` で足りるが、
 * serial → uuid のような作り直しが必要な変更はこれを上げる。
 * 不一致ならローカル DB を捨ててサーバから作り直す。ローカルはキャッシュで、
 * 耐久層はサーバという整理。
 *
 * **ただし outbox が空でない限り絶対に捨てないこと。** 未送信の書き込みが消える。
 */
export const SCHEMA_EPOCH = 1;

/** 適用済みの記録用。マイグレーション本体より先に必要なので別に持つ。 */
const META_DDL = `
CREATE TABLE IF NOT EXISTS _local_migrations (
	tag        text PRIMARY KEY,
	applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS _local_meta (
	key   text PRIMARY KEY,
	value text NOT NULL
);
`;

export type EpochCheck = { ok: true } | { ok: false; stored: number };

/** 未適用のマイグレーションを流す。世代が食い違っていたら流さずに報告する。 */
export async function applyMigrations(client: PGlite): Promise<EpochCheck> {
	await client.exec(META_DDL);

	const meta = await client.query<{ value: string }>(
		"select value from _local_meta where key = 'schema_epoch'",
	);
	const stored = meta.rows[0] ? Number(meta.rows[0].value) : null;
	if (stored !== null && stored !== SCHEMA_EPOCH) {
		return { ok: false, stored };
	}

	const done = await client.query<{ tag: string }>(
		"select tag from _local_migrations",
	);
	const applied = new Set(done.rows.map((r) => r.tag));

	for (const m of MIGRATIONS) {
		if (applied.has(m.tag)) continue;
		await client.exec(`BEGIN;
${m.sql}
INSERT INTO _local_migrations (tag) VALUES ('${m.tag}');
COMMIT;`);
	}

	await client.exec(
		`INSERT INTO _local_meta (key, value) VALUES ('schema_epoch', '${SCHEMA_EPOCH}')
		 ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
	);

	return { ok: true };
}
