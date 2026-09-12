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

/**
 * UI から見た API。lib/api.ts (HTTP) の後継。
 *
 * 中身は lib/domain/* をローカル DB に対して直接呼ぶだけで、
 * 戻り値は lib/serialize.ts を通すのでサーバの JSON と構造的に同一。
 * だから UI 側の変更は import 先の差し替えで済む。
 *
 * HTTP を経由しないので、失敗は Response ではなく例外で来る。
 * 呼び出し側は try/catch すること (以前は res.ok を見ていない箇所があり、
 * 500 のときに JSON パースで unhandled rejection になっていた)。
 */

/** 書き込み時刻。createdAt / updatedAt は必ず呼び出し側 = ここで決める。
 *  サーバの defaultNow() に任せると、オフラインで記録した行が
 *  「同期した日」の日付になり lib/jst.ts の日別集計が壊れる。 */
const now = () => new Date();

export async function createUser(username: string) {
	const { db } = await getLocalDb();
	const created = await domainCreateUser(db, {
		userId: uuidv7(),
		username,
		userMailAddress: null,
		updatedAt: now(),
	});
	await flushLocalDb();
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
	const created = await domainCreateBook(db, userId, {
		bookId: uuidv7(),
		bookTitle: input.bookTitle,
		status: input.status,
		bookPages: input.bookPages,
		updatedAt: now(),
	});
	if (!created) throw new Error("ユーザーが見つかりません");
	await flushLocalDb();
	return toBookResponse(created);
}

export async function recordProgress(
	userId: string,
	bookId: string,
	pagesRead: number,
) {
	const { db } = await getLocalDb();
	const updated = await domainRecordProgress(db, userId, bookId, {
		progressId: uuidv7(),
		pagesRead,
		createdAt: now(),
	});
	if (!updated) throw new Error("本が見つかりません");
	await flushLocalDb();
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
