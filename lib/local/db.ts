import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { DomainDb } from "../domain/db";
import * as schema from "../schema";
import { applyMigrations } from "./migrations";

/**
 * 端末内の PostgreSQL (PGlite / WASM)。オフライン時の作業用の正。
 *
 * ## PGlite はバンドルしない
 *
 * Turbopack は `@electric-sql/pglite` をバンドルすると、**本番ビルドでのみ**
 * 実行時に落ちる (`next dev` では動くので dev は何の証明にもならない):
 *
 *     TypeError: <x>.instantiateWasm is not a function
 *
 * 原因はスコープホイスティング時の識別子衝突で、initdb を起動する関数内の
 * ローカル変数が同名に潰された PGlite の名前空間参照を覆い隠している。
 * `experimental.turbopackMinify: false` でも直らない (ミニファイアではなく
 * モジュール併合の問題)。
 *
 * そこで scripts/copy-pglite.sh が実体を public/pglite/ に置き、ここでは
 * `turbopackIgnore` 付きの URL import でバンドラを迂回して読む。
 * PGlite 内部の `new URL("./pglite.wasm", import.meta.url)` が
 * `/pglite/pglite.wasm` に解決される。
 *
 * ## 動的 import は最適化ではなく正しさの要件
 *
 * 全ページ `"use client"` だが、Next はクライアントコンポーネントも
 * **ビルド時にプリレンダリングする**。モジュールスコープで `new PGlite()` すると
 * `next build` 中の Node で実行されてしまう。必ず `useEffect` 以降で呼ぶこと。
 *
 * ## マルチタブでは黙ってデータが消える
 *
 * PGlite は IndexedDB 上で単一接続前提。実測では、2 タブが同時に 1 件ずつ
 * insert すると**例外を出さずに**最終件数が 1 になった。エラーにならないので
 * 気づけない。`navigator.locks` で 2 タブ目を弾くのは任意の堅牢化ではなく必須。
 */

const DB_NAME = "hicoder";
const LOCK_NAME = "hicoder-pglite";

/** 2 タブ目。UI は「1 つのタブでのみ開けます」を出す。 */
export class TabConflictError extends Error {
	readonly name = "TabConflictError";
}

/** ローカル DB のスキーマ世代がコードと食い違っている。作り直しが要る。 */
export class SchemaEpochError extends Error {
	readonly name = "SchemaEpochError";
	constructor(readonly stored: number) {
		super(`ローカル DB のスキーマ世代が古い (stored=${stored})`);
	}
}

type LocalDb = { db: DomainDb; client: PGlite };

let pending: Promise<LocalDb> | null = null;

async function open(): Promise<LocalDb> {
	// 先にタブの排他を取る。取れなければ DB を開かない。
	//
	// navigator.locks.request() が返す promise は**コールバックが解決してから**
	// 解決する。ロックはページを閉じるまで持ち続けたいので、コールバックには
	// 決して解決しない promise を返す。つまりこの request 自体を await すると
	// 自分で自分をブロックする。granted 側だけを待つこと。
	let granted!: (held: boolean) => void;
	const gotLock = new Promise<boolean>((resolve) => {
		granted = resolve;
	});
	const forever = new Promise<never>(() => {});
	void navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
		granted(lock !== null);
		return lock !== null ? forever : Promise.resolve();
	});
	if (!(await gotLock)) {
		throw new TabConflictError("already open in another tab");
	}

	const mod = (await import(
		/* turbopackIgnore: true */ "/pglite/index.js" as string
	)) as typeof import("@electric-sql/pglite");

	const client = await mod.PGlite.create(`idb://${DB_NAME}`, {
		// 既定 (relaxedDurability: true) だと IndexedDB への書き出しがクエリの
		// 完了より後にずれ込み、**書き込み直後にリロードすると消える**
		// (実測: 書き込み 0 秒後のリロードで本が消え、3 秒待てば残る。
		//  オンライン / オフラインを問わず発生する)。
		// オフラインファーストの前提が崩れるので、速度より耐久性を採る。
		relaxedDurability: false,
	});
	const result = await applyMigrations(client);
	if (!result.ok) {
		await client.close();
		throw new SchemaEpochError(result.stored);
	}

	// IndexedDB は容量圧や Safari の 7 日ルールで追い出される。未送信の書き込みが
	// 消えると復旧手段が無いので、永続化を要求しておく (断られても続行する)。
	await navigator.storage?.persist?.().catch(() => false);

	return { db: drizzle(client, { schema }), client };
}

/** ローカル DB を返す。初回だけ開き、以降は同じハンドルを使い回す。 */
export function getLocalDb(): Promise<LocalDb> {
	if (typeof window === "undefined") {
		return Promise.reject(new Error("ローカル DB はブラウザ専用です"));
	}
	if (!pending) {
		pending = open().catch((e) => {
			// 失敗を握ったままにすると復旧できないので、次回は開き直せるようにする。
			pending = null;
			throw e;
		});
	}
	return pending;
}

/**
 * 書き込みを IndexedDB まで確実に押し出す。
 *
 * PGlite の IndexedDB 保存は既定で遅延する (relaxedDurability)。
 * 実測では、書き込み直後にリロードすると行が消えた
 * (0 秒後のリロードで消え、3 秒待てば残る。オンライン / オフラインを問わない)。
 * relaxedDurability: false を指定しても内部の syncToFs は
 * 「既に同期が予約済みなら即 return」する作りなので、最後の書き込みが
 * 取りこぼされうる。オフラインファーストで書き込みが消えるのは致命的なので、
 * 書き込みごとに明示的に押し出す。
 */
export async function flushLocalDb(): Promise<void> {
	if (!pending) return;
	const { client } = await pending;
	await client.syncToFs();
}

/** ローカル DB を捨ててサーバから作り直すための入口。
 *  **outbox が空であることを呼び出し側が確認してから使うこと。** */
export async function destroyLocalDb(): Promise<void> {
	if (pending) {
		const { client } = await pending.catch(() => ({ client: null }) as never);
		await client?.close();
		pending = null;
	}
	// PGlite は IndexedDB を "/pglite/<name>" という名前で作る (実測)。
	// 推測でハードコードすると削除が黙って空振りするので注意。
	await new Promise<void>((resolve) => {
		const req = indexedDB.deleteDatabase(`/pglite/${DB_NAME}`);
		req.onsuccess = req.onerror = req.onblocked = () => resolve();
	});
}
