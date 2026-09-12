/**
 * `@electric-sql/pglite` の差し替えスタブ (next.config.ts の turbopack.resolveAlias)。
 *
 * なぜ必要か:
 * `drizzle-orm/pglite` が `@electric-sql/pglite` を import しているため、
 * これをバンドルすると **Turbopack が壊れる方の PGlite を再び取り込む**。
 * Turbopack はこのパッケージをバンドルすると本番ビルドでのみ実行時に落ちる
 * (スコープホイスティング時の識別子衝突。README / lib/local/db.ts を参照)。
 * 実体は public/pglite/ から素の ESM として読むので、バンドル側は要らない。
 *
 * drizzle が実際に使うものを実物で確認した:
 *   - pglite/session.js  `types` の OID 定数 4 つだけ
 *   - pglite/driver.js   `new PGlite(...)` は「接続文字列を渡した場合」だけ通る経路。
 *                        こちらは構築済みクライアントを渡すので呼ばれない
 *   - `instanceof PGlite` は存在しない → public/ 製のインスタンスが弾かれることもない
 */

/** pg の型 OID。drizzle はこれをキーにパーサを恒等関数へ差し替えるだけ。 */
export const types = {
	DATE: 1082,
	TIMESTAMP: 1114,
	TIMESTAMPTZ: 1184,
	INTERVAL: 1186,
} as const;

export class PGlite {
	constructor() {
		throw new Error(
			"バンドルされた PGlite は使えません (Turbopack が壊します)。" +
				"lib/local/db.ts の getLocalDb() 経由で public/pglite から読み込んでください。",
		);
	}
}
