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
// 数分で使い切る。globalThis にキャッシュして使い回す。
//
// **本番でもキャッシュする。** サーバレス (Vercel 等) では 1 インスタンスが
// 複数のリクエストを跨いで生き続けるので、キャッシュしないと呼び出しごとに
// プールが増える。
const globalForDb = globalThis as unknown as { __pgPool?: pg.Pool };

/**
 * サーバレスでは 1 インスタンスあたり 1 接続にする。
 *
 * サーバレスは水平にいくらでも増えるので、インスタンスごとに 10 本張ると
 * Postgres の接続上限 (既定 100) をすぐ使い切る。1 本にしたうえで、
 * **接続文字列は接続プーラ経由のものを使うこと**
 * (Neon の -pooler、Supabase の pgbouncer ポート 6543 など)。
 *
 * 常駐サーバ (docker compose / next start) では従来どおり 10 本張る。
 */
const isServerless = Boolean(
	process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
);

const pool =
	globalForDb.__pgPool ??
	new pg.Pool({
		connectionString: process.env.DATABASE_URL,
		max: isServerless ? 1 : 10,
		// 使われていない接続を掴み続けない (プーラ側の上限にも効く)
		idleTimeoutMillis: isServerless ? 10_000 : 30_000,
	});

globalForDb.__pgPool = pool;

export const db = drizzle(pool, { schema });
