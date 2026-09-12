import { beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../schema";
import { uuidv7 } from "../uuid";
import {
	createBook,
	getBook,
	listBooks,
	recomputeUser,
	updateBook,
} from "./books";
import type { DomainDb } from "./db";
import {
	getHistory,
	getProgressOnDay,
	latestActiveBookId,
	recordProgress,
} from "./progress";
import { getTreeState } from "./tree";
import { createUser, getUser, updateUserName } from "./users";

// lib/domain/* は db ハンドルの純関数なので、インメモリ PGlite が
// そのまま密封テスト DB になる (Docker 不要)。
//
// PGlite の起動はプロセスあたり数秒かかるので、必ずファイルで 1 個だけ作り、
// テストごとに TRUNCATE する。beforeEach で作り直すと現実的な時間で終わらない。
const client = new PGlite();
const db: DomainDb = drizzle(client, { schema });
const ddl = readFileSync(
	`${import.meta.dir}/../../drizzle/0000_equal_thena.sql`,
	"utf8",
);
await client.exec(ddl);

beforeEach(async () => {
	await client.exec(
		"TRUNCATE progress, books_list, users RESTART IDENTITY CASCADE;",
	);
});

const now = () => new Date();

async function seed(bookPages: number, status = "積読") {
	const user = await createUser(db, {
		userId: uuidv7(),
		username: `u-${uuidv7()}`,
		userMailAddress: null,
		updatedAt: now(),
	});
	const book = await createBook(db, user.userId, {
		bookId: uuidv7(),
		bookTitle: "t",
		status,
		bookPages,
		updatedAt: now(),
	});
	if (!book) throw new Error("seed failed");
	return { userId: user.userId, bookId: book.bookId };
}

const record = (userId: string, bookId: string, pages: number, at = now()) =>
	recordProgress(db, userId, bookId, {
		progressId: uuidv7(),
		pagesRead: pages,
		createdAt: at,
	});

// ── users / books ──

test("createBook が number_of_books を加算する", async () => {
	const { userId } = await seed(100);
	expect((await getUser(db, userId))?.numberOfBooks).toBe(1);
	expect((await listBooks(db, userId)).length).toBe(1);
});

test("createBook は存在しないユーザーで null", async () => {
	const orphan = await createBook(db, uuidv7(), {
		bookId: uuidv7(),
		bookTitle: "t",
		status: "積読",
		bookPages: 1,
		updatedAt: now(),
	});
	expect(orphan).toBeNull();
});

test("status が保存される (既知バグ #3 修正)", async () => {
	const { userId, bookId } = await seed(100, "読書中");
	expect((await getBook(db, userId, bookId))?.status).toBe("読書中");

	const updated = await updateBook(db, userId, bookId, {
		bookTitle: "t",
		status: "読了",
		bookPages: 100,
		updatedAt: now(),
	});
	expect(updated?.status).toBe("読了");
});

test("updateUserName は存在しないユーザーで null (呼び出し側が 404 にする / 既知バグ #1 修正)", async () => {
	expect(await updateUserName(db, uuidv7(), "x", now())).toBeNull();
});

test("同じ username を 2 人が使える (unique 索引を落としたため)", async () => {
	const mk = () =>
		createUser(db, {
			userId: uuidv7(),
			username: "same",
			userMailAddress: null,
			updatedAt: now(),
		});
	await mk();
	expect((await mk()).username).toBe("same");
});

test("recomputeUser が number_of_books を数え直す", async () => {
	const { userId } = await seed(100);
	// 派生値をわざと壊してから数え直させる
	await db
		.update(schema.users)
		.set({ numberOfBooks: 99 })
		.where(eq(schema.users.userId, userId));
	expect((await getUser(db, userId))?.numberOfBooks).toBe(99);

	await recomputeUser(db, userId);
	expect((await getUser(db, userId))?.numberOfBooks).toBe(1);
});

// ── 木の計算 (既知バグ #1 / #4 修正後の値) ──

test("tree_state 1: 進捗が半分未満", async () => {
	const { userId, bookId } = await seed(120);
	const r = await record(userId, bookId, 30);
	expect(r).toMatchObject({ totalProgress: 30, treeRatio: 25, treeState: 1 });
});

test("tree_state 2: ちょうど半分で 50 (以前は 1e-8 ガードで 49 だった)", async () => {
	const { userId, bookId } = await seed(120);
	const r = await record(userId, bookId, 60);
	expect(r).toMatchObject({ totalProgress: 60, treeRatio: 50, treeState: 2 });
});

test("tree_state 3: 読了で 100 に到達する (以前は 99 止まりで到達不能だった)", async () => {
	const { userId, bookId } = await seed(120);
	await record(userId, bookId, 60);
	const r = await record(userId, bookId, 60);
	expect(r).toMatchObject({ totalProgress: 120, treeRatio: 100, treeState: 3 });
});

test("ページ数を超えて記録しても 100 でクランプされる", async () => {
	const { userId, bookId } = await seed(10);
	const r = await record(userId, bookId, 999);
	expect(r).toMatchObject({ totalProgress: 999, treeRatio: 100, treeState: 3 });
});

test("book_pages=0 でも 500 にならない (既知バグ #4 修正)", async () => {
	const { userId, bookId } = await seed(0);
	// 以前は trunc(1 / 1e-8 * 100) = 1e10 が int4 を溢れてトランザクションごと落ちていた。
	const r = await record(userId, bookId, 1);
	expect(r).toMatchObject({ totalProgress: 1, treeRatio: 0, treeState: 1 });
	expect(
		(await getHistory(db, userId, bookId, { limit: 20, offset: 0 }))?.history
			.length,
	).toBe(1);
});

test("recordProgress は存在しない本で null", async () => {
	const { userId } = await seed(100);
	expect(await record(userId, uuidv7(), 10)).toBeNull();
});

test("進捗は合算され、合計は必ず行から導出される", async () => {
	const { userId, bookId } = await seed(100);
	await record(userId, bookId, 10);
	await record(userId, bookId, 20);
	const r = await record(userId, bookId, 5);
	expect(r?.totalProgress).toBe(35);
	expect(await getTreeState(db, userId, bookId)).toMatchObject({
		treeRatio: 35,
		treeState: 1,
	});
});

// ── 履歴 ──

test("getHistory は作成順で、limit/offset が progress 行に効く (既知バグ #2 修正)", async () => {
	const { userId, bookId } = await seed(100);
	for (const n of [3, 1, 2]) await record(userId, bookId, n);

	const all = await getHistory(db, userId, bookId, { limit: 20, offset: 0 });
	expect(all?.history.map((r) => r.progress)).toEqual([3, 1, 2]);
	expect(all?.totalProgress).toBe(6);

	// 以前は offset>=1 が 404、limit は一切効かなかった。
	const paged = await getHistory(db, userId, bookId, { limit: 1, offset: 1 });
	expect(paged?.history.map((r) => r.progress)).toEqual([1]);
	// total_progress は本の派生値なのでページングとは独立
	expect(paged?.totalProgress).toBe(6);
});

test("getHistory は存在しない本で null", async () => {
	const { userId } = await seed(100);
	expect(
		await getHistory(db, userId, uuidv7(), { limit: 20, offset: 0 }),
	).toBeNull();
});

test("getProgressOnDay は JST の当日だけ数える", async () => {
	const { userId, bookId } = await seed(100);
	await record(userId, bookId, 7);
	const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
	expect(await getProgressOnDay(db, userId, bookId, today)).toBe(7);
	expect(await getProgressOnDay(db, userId, bookId, "2000-01-01")).toBe(0);
	expect(await getProgressOnDay(db, userId, uuidv7(), today)).toBeNull();
});

test("createdAt は呼び出し側の値が入る (オフラインで記録した日付が保たれる)", async () => {
	const { userId, bookId } = await seed(100);
	const tuesday = new Date("2026-09-08T03:00:00Z"); // JST 12:00
	await record(userId, bookId, 5, tuesday);
	expect(await getProgressOnDay(db, userId, bookId, "2026-09-08")).toBe(5);
});

// ── ProgressTree の本の選び方 (既知バグ #6 修正) ──

test("latestActiveBookId は直近に記録した本を返す", async () => {
	const { userId, bookId } = await seed(100);
	const second = await createBook(db, userId, {
		bookId: uuidv7(),
		bookTitle: "second",
		status: "積読",
		bookPages: 50,
		updatedAt: now(),
	});
	if (!second) throw new Error("setup failed");

	// まだ記録が無ければ最後に登録した本
	expect(await latestActiveBookId(db, userId)).toBe(second.bookId);

	// 記録したらその本
	await record(userId, bookId, 1);
	expect(await latestActiveBookId(db, userId)).toBe(bookId);
});

test("latestActiveBookId は本が 1 冊も無ければ null", async () => {
	const user = await createUser(db, {
		userId: uuidv7(),
		username: "empty",
		userMailAddress: null,
		updatedAt: now(),
	});
	expect(await latestActiveBookId(db, user.userId)).toBeNull();
});
