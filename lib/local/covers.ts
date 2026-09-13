import { sql } from "drizzle-orm";
import type { DomainDb } from "../domain/db";
import { flushLocalDb, getLocalDb } from "./db";

/**
 * ISBN から取得した表紙 (data URI) の端末内キャッシュ。ローカル専用。
 *
 * **同期しない。** 1 枚で数 KB〜数十 KB あり、同期ペイロードとサーバ DB を
 * 膨らませるだけで、books_list.isbn が同期されていればいつでも引き直せる。
 * 「ローカルはキャッシュ、耐久層はサーバ」という既存の整理と揃えている。
 *
 * data URI で持つのは lib/placeholder.ts と同じ理由。外部 URL を UI に渡すと
 * **オフラインで確認したい画面だけ表紙が壊れて見える**。
 */

/**
 * `DomainDb` は総称型で `execute()` の戻りが unknown になる。
 * lib/local/outbox.ts と同じ寄せ方。
 */
async function rows<T>(
	db: DomainDb,
	query: Parameters<DomainDb["execute"]>[0],
) {
	const res = (await db.execute(query)) as { rows?: T[] } | T[];
	return (Array.isArray(res) ? res : (res.rows ?? [])) as T[];
}

/** 表紙を保存する。同じ ISBN なら上書き。 */
export async function putCover(isbn: string, dataUri: string): Promise<void> {
	const { db } = await getLocalDb();
	await db.execute(
		sql`insert into book_covers (isbn, data_uri)
		    values (${isbn}, ${dataUri})
		    on conflict (isbn) do update
		      set data_uri = excluded.data_uri, fetched_at = now()`,
	);
	// これを忘れるとリロードで消える (PGlite は IndexedDB への書き出しを遅延する)。
	await flushLocalDb();
}

/** 表紙を取り出す。無ければ null。 */
export async function getCover(isbn: string): Promise<string | null> {
	const { db } = await getLocalDb();
	const found = await rows<{ data_uri: string }>(
		db,
		sql`select data_uri from book_covers where isbn = ${isbn}`,
	);
	return found[0]?.data_uri ?? null;
}

/** 本棚のように複数枚まとめて要るとき用。ISBN → data URI。 */
export async function getCovers(isbns: string[]): Promise<Map<string, string>> {
	const wanted = isbns.filter((s) => s.length > 0);
	if (wanted.length === 0) return new Map();

	const { db } = await getLocalDb();
	const found = await rows<{ isbn: string; data_uri: string }>(
		db,
		sql`select isbn, data_uri from book_covers
		    where isbn in (${sql.join(
					wanted.map((s) => sql`${s}`),
					sql`, `,
				)})`,
	);
	return new Map(found.map((r) => [r.isbn, r.data_uri]));
}
