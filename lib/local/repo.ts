"use client";

import {
	createBook as domainCreateBook,
	listBooks as domainListBooks,
} from "../domain/books";
import {
	latestActiveBookId as domainLatestActiveBookId,
	recordProgress as domainRecordProgress,
} from "../domain/progress";
import { getTreeState as domainGetTreeState } from "../domain/tree";
import { createUser as domainCreateUser, getUser } from "../domain/users";
import {
	toBookResponse,
	toProgressUpdateResponse,
	toTreeStateResponse,
	toUserResponse,
} from "../serialize";
import { uuidv7 } from "../uuid";
import { flushLocalDb, getLocalDb } from "./db";
import { enqueue } from "./outbox";
import { refreshSyncState, sync } from "./sync";

/**
 * UI から見た API。かつての lib/api.ts (HTTP) の後継。
 *
 * 中身は lib/domain/* を端末内 DB に対して直接呼ぶだけで、
 * 戻り値は lib/serialize.ts を通すのでサーバの JSON と構造的に同一。
 * だから UI 側の変更は import 先の差し替えで済んでいる。
 *
 * HTTP を経由しないので、失敗は Response ではなく例外で来る。
 * 呼び出し側は try/catch すること。
 */

/** 書き込み時刻。createdAt / updatedAt は必ず呼び出し側 = ここで決める。
 *  サーバの defaultNow() に任せると、オフラインで記録した行が
 *  「同期した日」の日付になり lib/jst.ts の日別集計が壊れる。 */
const now = () => new Date();

export async function createUser(username: string) {
	const { db } = await getLocalDb();
	const userId = uuidv7();
	const at = now();

	const created = await db.transaction(async (tx) => {
		const row = await domainCreateUser(tx, {
			userId,
			username,
			userMailAddress: null,
			updatedAt: at,
		});
		// 書き込みと同じトランザクションで積む。別にすると
		// 「ローカルには入ったが送信されない」行が生まれる。
		await enqueue(tx, "user.create", userId, {
			user_id: userId,
			username,
			updated_at: at.toISOString(),
		});
		return row;
	});

	await flushLocalDb();
	// **await する。** fire-and-forget にすると、書き込み直後に一瞬
	// 「同期済み」と表示される窓ができる。ユーザーが送信済みと誤解しうる。
	await refreshSyncState();
	void sync(userId);
	return toUserResponse(created);
}

/** 既存のユーザー ID でこの端末を紐付けられるか調べる。
 *  ログインが無いので、2 台目の端末はこの経路で合流する。 */
export async function findUser(userId: string) {
	const { db } = await getLocalDb();
	const user = await getUser(db, userId);
	return user ? toUserResponse(user) : null;
}

export async function listBooks(userId: string) {
	const { db } = await getLocalDb();
	const rows = await domainListBooks(db, userId);
	return rows.map(toBookResponse);
}

export async function createBook(
	userId: string,
	input: { bookTitle: string; status: string; bookPages: number },
) {
	const { db } = await getLocalDb();
	const bookId = uuidv7();
	const at = now();

	const created = await db.transaction(async (tx) => {
		const row = await domainCreateBook(tx, userId, {
			bookId,
			bookTitle: input.bookTitle,
			status: input.status,
			bookPages: input.bookPages,
			updatedAt: at,
		});
		if (!row) throw new Error("ユーザーが見つかりません");

		await enqueue(tx, "book.create", bookId, {
			book_id: bookId,
			user_id: userId,
			book_title: input.bookTitle,
			status: input.status,
			book_pages: input.bookPages,
			updated_at: at.toISOString(),
		});
		return row;
	});

	await flushLocalDb();
	await refreshSyncState();
	void sync(userId);
	return toBookResponse(created);
}

export async function recordProgress(
	userId: string,
	bookId: string,
	pagesRead: number,
) {
	const { db } = await getLocalDb();
	const progressId = uuidv7();
	const at = now();

	const updated = await db.transaction(async (tx) => {
		const row = await domainRecordProgress(tx, userId, bookId, {
			progressId,
			pagesRead,
			createdAt: at,
		});
		if (!row) throw new Error("本が見つかりません");

		await enqueue(tx, "progress.record", progressId, {
			progress_id: progressId,
			book_id: bookId,
			user_id: userId,
			progress: pagesRead,
			created_at: at.toISOString(),
		});
		return row;
	});

	await flushLocalDb();
	await refreshSyncState();
	void sync(userId);
	return toProgressUpdateResponse(updated);
}

/** ProgressTree が出す木。対象の本が 1 冊も無ければ null。 */
export async function getTreeState(userId: string) {
	const { db } = await getLocalDb();
	const bookId = await domainLatestActiveBookId(db, userId);
	if (!bookId) return null;
	const tree = await domainGetTreeState(db, userId, bookId);
	return tree ? toTreeStateResponse(tree) : null;
}
