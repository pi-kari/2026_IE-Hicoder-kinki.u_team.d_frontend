"use client";

import { sql } from "drizzle-orm";
import {
	type SyncOp,
	SyncPullResponseSchema,
	SyncPushResponseSchema,
} from "schemas/sync";
import type { DomainDb } from "../domain/db";
import {
	applyProgress,
	recomputeAll,
	upsertBook,
	upsertUser,
} from "../domain/sync";
import { flushLocalDb, getLocalDb } from "./db";
import {
	backoff,
	deadLetter,
	deadLetterCount,
	pending,
	pendingCount,
	pendingEntityIds,
	remove,
} from "./outbox";

/**
 * サーバとの同期。
 *
 * 端末内 DB が作業用の正で、サーバは同期先兼バックアップ。
 * ElectricSQL は使わない。読み取り同期しか提供せず、書き出しも競合解決も
 * 結局自前になるうえ、同期サービスのコンテナと論理レプリケーションが要る。
 * 3 テーブル・数百行・1 端末 1 ユーザーには重すぎる。
 */

/** `DomainDb` は総称型なので `execute()` の戻りが unknown になる。 */
async function rows<T>(
	db: DomainDb,
	query: Parameters<DomainDb["execute"]>[0],
) {
	const res = (await db.execute(query)) as { rows?: T[] } | T[];
	return (Array.isArray(res) ? res : (res.rows ?? [])) as T[];
}

export type SyncState = {
	/** 未送信の件数 */
	pending: number;
	/** 二度と送れない件数 (要対処) */
	failed: number;
	/** 最後に同期が成功した時刻 */
	lastSyncedAt: Date | null;
	/** 同期中かどうか */
	running: boolean;
};

type Listener = (state: SyncState) => void;

let state: SyncState = {
	pending: 0,
	failed: 0,
	lastSyncedAt: null,
	running: false,
};
const listeners = new Set<Listener>();

function publish(patch: Partial<SyncState>) {
	state = { ...state, ...patch };
	for (const l of listeners) l(state);
}

export function subscribeSync(listener: Listener): () => void {
	listeners.add(listener);
	listener(state);
	return () => listeners.delete(listener);
}

export function syncState(): SyncState {
	return state;
}

/** 送信待ち件数を読み直して配る (書き込み後に呼ぶ)。 */
export async function refreshSyncState(): Promise<void> {
	const { db } = await getLocalDb();
	publish({
		pending: await pendingCount(db),
		failed: await deadLetterCount(db),
	});
}

// 同時に 2 本走らせない。
// ただし**走行中に来た要求は捨てずに、終わったらもう一度走らせる**。
// 相乗りさせるだけだと、同期の最中に書いた行が取り残され、
// 次の契機 (30 秒間隔の定期実行) まで送られないままになる。
let inFlight: Promise<void> | null = null;
let queued = false;

/**
 * 送信 → 取得 → 再計算を 1 往復ぶん行う。
 *
 * navigator.onLine は**ヒントでしかない** (キャプティブポータルや死んだ VPN で
 * true になる)。試行を省くためだけに使い、真の判定はリクエストの実失敗に委ねる。
 */
export function sync(userId: string): Promise<void> {
	if (inFlight) {
		queued = true;
		return inFlight;
	}
	inFlight = runSync(userId)
		.finally(() => {
			inFlight = null;
		})
		.then(() => {
			if (!queued) return;
			queued = false;
			return sync(userId);
		});
	return inFlight;
}

async function runSync(userId: string): Promise<void> {
	if (typeof navigator !== "undefined" && navigator.onLine === false) return;

	publish({ running: true });
	try {
		const { db } = await getLocalDb();
		const pushed = await push(db);
		if (pushed) {
			await pull(db, userId);
			publish({ lastSyncedAt: new Date() });
			// pull の最中に書かれた行があれば、待たずに次の周回で送る
			if ((await pendingCount(db)) > 0) queued = true;
		}
		await flushLocalDb();
		publish({
			pending: await pendingCount(db),
			failed: await deadLetterCount(db),
		});
	} catch (error) {
		// オフラインなら普通に起きる。次の契機で再試行する。
		console.warn("同期に失敗しました", error);
	} finally {
		publish({ running: false });
	}
}

/**
 * 既存のユーザー ID でこの端末を合流させる。
 *
 * このアプリにログインは無く /register は常に新規ユーザーを作るので、
 * 2 台目の端末はここを通る。ローカル DB はまだ空なので、
 * **サーバから取り寄せてから**紐付けの可否を判断する。
 *
 * @returns そのユーザーが存在したか
 */
export async function joinUser(userId: string): Promise<boolean> {
	const { db } = await getLocalDb();
	await pull(db, userId);
	await flushLocalDb();

	const found = await rows<{ n: number }>(
		db,
		sql`select count(*)::int as n from users where user_id = ${userId}`,
	);
	return (found[0]?.n ?? 0) > 0;
}

/**
 * outbox を排出する。
 *
 * **id 昇順で厳密に送り、一時的な失敗が出たらそこで止める。**
 * uuidv7 が因果順を保証しているので、止めれば順序が守られる。
 * 4xx 相当 (rejected) は再送しても成功しないので dead letter にして先へ進む。
 *
 * @returns 送信まで到達したか (オフライン等で 1 度も送れなければ false)
 */
async function push(db: DomainDb): Promise<boolean> {
	const rows = await pending(db);
	if (rows.length === 0) return true;

	const ops: SyncOp[] = rows.map(
		(r) => ({ id: r.id, op: r.op, payload: r.payload }) as SyncOp,
	);

	const res = await fetch("/api/sync/push", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ops }),
	});
	if (!res.ok) throw new Error(`push failed: ${res.status}`);

	const { results } = SyncPushResponseSchema.parse(await res.json());

	const done: string[] = [];
	for (const r of results) {
		if (r.status === "ok") {
			done.push(r.id);
			continue;
		}
		if (r.status === "rejected") {
			await deadLetter(db, r.id, r.error ?? "rejected");
			continue;
		}
		// 一時的な失敗。ここで止めて順序を守る。
		await backoff(db, r.id, r.error ?? "failed");
		await remove(db, done);
		return false;
	}
	await remove(db, done);
	return true;
}

/**
 * サーバの行を取り込む。
 *
 * 順序は users → books → progress。サーバにもローカルにも実 FK があり、
 * progress は本を参照するため。
 */
async function pull(db: DomainDb, userId: string): Promise<void> {
	const res = await fetch(
		`/api/sync/pull?user_id=${encodeURIComponent(userId)}`,
	);
	if (!res.ok) throw new Error(`pull failed: ${res.status}`);

	const data = SyncPullResponseSchema.parse(await res.json());

	// ローカルに未送信の変更がある行はサーバの値で上書きしない。
	// 今回はローカルが勝ち、送信が済んだ次の回にサーバが勝つ。
	const held = await pendingEntityIds(db);
	const touched = new Set<string>();
	const at = new Date();

	await db.transaction(async (tx) => {
		for (const u of data.users) {
			if (held.has(u.user_id)) continue;
			await upsertUser(tx, {
				userId: u.user_id,
				username: u.username,
				userMailAddress: u.user_mail_address,
				updatedAt: new Date(u.updated_at),
			});
		}

		for (const b of data.books) {
			if (held.has(b.book_id)) continue;
			await upsertBook(tx, {
				bookId: b.book_id,
				userId: b.user_id,
				bookTitle: b.book_title,
				status: b.status,
				bookPages: b.book_pages,
				updatedAt: new Date(b.updated_at),
			});
			touched.add(b.book_id);
		}

		for (const p of data.progress) {
			// progress は追記のみで不変。同じ id なら何もしないので、
			// 2 端末の記録は自然に合算される。
			await applyProgress(tx, {
				progressId: p.progress_id,
				bookId: p.book_id,
				userId: p.user_id,
				pagesRead: p.progress,
				createdAt: new Date(p.created_at),
			});
			touched.add(p.book_id);
		}

		// 派生カラムは運ばずに数え直す。
		await recomputeAll(tx, userId, [...touched], at);
	});
}
