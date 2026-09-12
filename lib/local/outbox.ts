import { sql } from "drizzle-orm";
import type { SyncOp } from "schemas/sync";
import type { DomainDb } from "../domain/db";
import { uuidv7 } from "../uuid";

/**
 * 未送信の書き込みキュー。ローカル専用 (drizzle スキーマには含めない)。
 *
 * **積むのは書き込みと同じトランザクション内**。そうしないと
 * 「ローカルには入ったが送信されない」行や、その逆が生まれる。
 *
 * id は uuidv7 なので **id 昇順 = 因果順**。これで book.create が必ず
 * その本の progress.record より先にサーバへ届く (サーバには実 FK がある)。
 */

/**
 * `DomainDb` は総称型なので `execute()` の戻りが unknown になる。
 * PGlite も node-postgres も `{ rows }` を返すが、drizzle の型からは
 * それを取り出せないのでここで 1 箇所だけ寄せる。
 */
async function rows<T>(
	db: DomainDb,
	query: Parameters<DomainDb["execute"]>[0],
) {
	const res = (await db.execute(query)) as { rows?: T[] } | T[];
	return (Array.isArray(res) ? res : (res.rows ?? [])) as T[];
}

export type OutboxRow = {
	id: string;
	op: SyncOp["op"];
	entity_id: string;
	payload: SyncOp["payload"];
	attempts: number;
};

/** 書き込みと同じトランザクションで積む。 */
export async function enqueue(
	tx: DomainDb,
	op: SyncOp["op"],
	entityId: string,
	payload: SyncOp["payload"],
): Promise<void> {
	await tx.execute(
		sql`insert into outbox (id, op, entity_id, payload)
		    values (${uuidv7()}, ${op}, ${entityId}, ${JSON.stringify(payload)}::jsonb)`,
	);
}

/** 送信待ちを因果順に取り出す。dead letter と待機中は除く。 */
export async function pending(db: DomainDb, limit = 200): Promise<OutboxRow[]> {
	return rows<OutboxRow>(
		db,
		sql`select id, op, entity_id, payload, attempts
		    from outbox
		    where failed_at is null and next_try_at <= now()
		    order by id
		    limit ${limit}`,
	);
}

/** 送信待ちの件数 (UI に出す)。 */
export async function pendingCount(db: DomainDb): Promise<number> {
	const found = await rows<{ n: number }>(
		db,
		sql`select count(*)::int as n from outbox where failed_at is null`,
	);
	return found[0]?.n ?? 0;
}

/** その entity に未送信の変更があるか。pull のマージで使う
 *  (ローカルの未送信はサーバの値に上書きさせない)。 */
export async function pendingEntityIds(db: DomainDb): Promise<Set<string>> {
	const found = await rows<{ entity_id: string }>(
		db,
		sql`select distinct entity_id from outbox where failed_at is null`,
	);
	return new Set(found.map((r) => r.entity_id));
}

export async function remove(db: DomainDb, ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	await db.execute(
		sql`delete from outbox where id in ${sql.raw(`(${ids.map((i) => `'${i}'`).join(",")})`)}`,
	);
}

/** 一時的な失敗。指数バックオフで待たせる。 */
export async function backoff(
	db: DomainDb,
	id: string,
	error: string,
): Promise<void> {
	await db.execute(
		sql`update outbox
		    set attempts = attempts + 1,
		        last_error = ${error},
		        next_try_at = now() + (least(power(2, attempts), 300) || ' seconds')::interval
		    where id = ${id}`,
	);
}

/** 二度と成功しない。dead letter にして飛ばす。
 *  NOTE: book.create を dead letter にすると、その本の progress.record は
 *  サーバ側で「本が無い」と言われて連鎖的に dead letter になる。 */
export async function deadLetter(
	db: DomainDb,
	id: string,
	error: string,
): Promise<void> {
	await db.execute(
		sql`update outbox set failed_at = now(), last_error = ${error} where id = ${id}`,
	);
}

/** dead letter の件数 (UI に出す)。 */
export async function deadLetterCount(db: DomainDb): Promise<number> {
	const found = await rows<{ n: number }>(
		db,
		sql`select count(*)::int as n from outbox where failed_at is not null`,
	);
	return found[0]?.n ?? 0;
}
