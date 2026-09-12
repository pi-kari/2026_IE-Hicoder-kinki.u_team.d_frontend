import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

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
