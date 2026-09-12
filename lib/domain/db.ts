import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "../schema";

/**
 * 業務ロジックが受け取る DB ハンドルの型。
 *
 * `NodePgDatabase` (サーバの pg.Pool)、`PgliteDatabase` (ブラウザの WASM)、
 * `PgTransaction` (`db.transaction` の tx) がすべて `PgDatabase` を継承するので、
 * この 1 つの型で 3 つとも受けられる。これが lib/domain/* を
 * サーバ・ブラウザ両対応にできる理由であり、SQLite ではなく PGlite を選んだ理由。
 *
 * tx も同じ型なので、同期の push エンドポイントが op ごとに SAVEPOINT を張って
 * 同じ関数を呼ぶことができる (ネスト transaction = SAVEPOINT は実測で確認済み)。
 */
export type DomainDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * 「見つからなかった」を表す戻り値は `null` で統一する。
 *
 * どの関数も 404 になりうる原因は 1 種類しかないので、`null` から
 * User not found / Book not found への対応は呼び出し側で一意に決まる:
 *   getUser / createBook          -> User not found
 *   getBook / updateBook          -> Book not found
 *   getTreeState / recordProgress -> Book not found
 *   getHistory                    -> Book not found
 * 将来 1 つの関数が 2 種類の 404 を持つようになったら、この前提が崩れるので
 * そのときは理由を持つ型に変えること。
 */
