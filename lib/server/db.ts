// このモジュールがクライアントバンドルに混ざったらビルド時に落とす。
// Phase 3 で UI が lib/domain/* を直接呼ぶようになると、誤って pg.Pool 側を
// 引き込む経路ができうるため、境界を型ではなくビルドで守る。
//
// NOTE: server-only の default エントリは無条件 throw なので、
// bun/node から直接このファイルを import するとその場で落ちる。
// lib/domain/* のユニットテストはインメモリ PGlite を使い、ここを通らない。
import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../schema";

// Next の dev サーバは編集のたびにモジュールを再評価する。モジュールスコープで
// new Pool() すると再評価ごとにプールが増え、Postgres の接続上限 (既定 100) を
// 数分で使い切る。開発時だけ globalThis にキャッシュして使い回す。
const globalForDb = globalThis as unknown as { __pgPool?: pg.Pool };

const pool =
	globalForDb.__pgPool ??
	new pg.Pool({
		connectionString: process.env.DATABASE_URL,
		max: 10,
	});

if (process.env.NODE_ENV !== "production") {
	globalForDb.__pgPool = pool;
}

export const db = drizzle(pool, { schema });
