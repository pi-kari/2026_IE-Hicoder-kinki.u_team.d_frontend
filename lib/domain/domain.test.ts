import { beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../schema";
import { createBook, getBook, listBooks, updateBook } from "./books";
import type { DomainDb } from "./db";
import { getHistory, getProgressOnDay, recordProgress } from "./progress";
import { getTreeState } from "./tree";
import { createUser, getUser, updateUserName } from "./users";

// lib/domain/* は db ハンドルの純関数なので、インメモリ PGlite が
// そのまま密封テスト DB になる (Docker 不要)。
//
// PGlite の起動はプロセスあたり 8〜13 秒かかるので、必ずファイルで 1 個だけ作り、
// テストごとに TRUNCATE する。beforeEach で作り直すと現実的な時間で終わらない。
const client = new PGlite();
const db: DomainDb = drizzle(client, { schema });
const ddl = readFileSync(
	`${import.meta.dir}/../../drizzle/0000_friendly_morg.sql`,
	"utf8",
);
await client.exec(ddl);

beforeEach(async () => {
	await client.exec(
		"TRUNCATE progress, books_list, users RESTART IDENTITY CASCADE;",
	);
});

async function seed(bookPages: number) {
	const user = await createUser(db, { username: "u", userMailAddress: null });
	const book = await createBook(db, user.userId, {
		bookTitle: "t",
		bookPages,
	});
	if (!book) throw new Error("seed failed");
	return { userId: user.userId, bookId: book.bookId };
}

test("createBook が number_of_books を加算する", async () => {
	const { userId } = await seed(100);
	expect((await getUser(db, userId))?.numberOfBooks).toBe(1);
	expect((await listBooks(db, userId)).length).toBe(1);
});

test("createBook は存在しないユーザーで null", async () => {
	expect(
		await createBook(db, 999, { bookTitle: "t", bookPages: 1 }),
	).toBeNull();
});

test("createBook は status を無視して既定値を入れる (既知バグ #3)", async () => {
	const { userId, bookId } = await seed(100);
	expect((await getBook(db, userId, bookId))?.status).toBe("積読");
});

// ── 木の計算。Phase 2 でここが変わるので、現在値をここに固定しておく ──

test("tree_state 1: 進捗が半分未満", async () => {
	const { userId, bookId } = await seed(120);
	const r = await recordProgress(db, userId, bookId, 30);
	expect(r).toMatchObject({ totalProgress: 30, treeRatio: 24, treeState: 1 });
});

test("tree_state 2: ちょうど半分。1e-8 ガードで 50 ではなく 49 になる", async () => {
	const { userId, bookId } = await seed(120);
	const r = await recordProgress(db, userId, bookId, 60);
	// Phase 2 で 1e-8 を外すとここは 50 / state 2 になる。それは修正であって退行ではない。
	expect(r).toMatchObject({ totalProgress: 60, treeRatio: 49, treeState: 1 });
});

test("読了しても 1e-8 ガードで 99 止まり。tree_state 3 に到達できない", async () => {
	const { userId, bookId } = await seed(120);
	await recordProgress(db, userId, bookId, 60);
	const r = await recordProgress(db, userId, bookId, 60);
	// Phase 2 で 1e-8 を外すとここは 100 / state 3 になり、tree_3.png が初めて表示される。
	expect(r).toMatchObject({ totalProgress: 120, treeRatio: 99, treeState: 2 });
});

test("book_pages=0 は int4 オーバーフローで throw する (既知バグ #4)", async () => {
	const { userId, bookId } = await seed(0);
	// rawRatio = trunc(1 / 1e-8 * 100) = 1e10 が tree_ratio (int4) に入らない。
	// ハンドラ側は withErrorHandling でこれを 500 plain text にしている。
	expect(recordProgress(db, userId, bookId, 1)).rejects.toThrow();
});

test("オーバーフローはトランザクションごと巻き戻る", async () => {
	const { userId, bookId } = await seed(0);
	await recordProgress(db, userId, bookId, 1).catch(() => {});
	const book = await getBook(db, userId, bookId);
	expect(book).toMatchObject({ totalProgress: 0, treeRatio: 0, treeState: 1 });
	expect(
		(await getHistory(db, userId, bookId, { offset: 0 }))?.history,
	).toEqual([]);
});

test("recordProgress は存在しない本で null", async () => {
	const { userId } = await seed(100);
	expect(await recordProgress(db, userId, 999, 10)).toBeNull();
});

// ── 派生カラムは必ず SUM から出す (同期設計の要) ──

test("進捗は合算される。合計は行から導出される", async () => {
	const { userId, bookId } = await seed(100);
	await recordProgress(db, userId, bookId, 10);
	await recordProgress(db, userId, bookId, 20);
	const r = await recordProgress(db, userId, bookId, 5);
	expect(r?.totalProgress).toBe(35);
	expect((await getTreeState(db, userId, bookId))?.treeRatio).toBe(34);
});

test("getHistory は progress_id 昇順で決定的", async () => {
	const { userId, bookId } = await seed(100);
	for (const n of [3, 1, 2]) await recordProgress(db, userId, bookId, n);
	const h = await getHistory(db, userId, bookId, { offset: 0 });
	expect(h?.history.map((r) => r.progress)).toEqual([3, 1, 2]);
	expect(h?.totalProgress).toBe(6);
});

test("getHistory は offset>=1 で null (既知バグ #2)", async () => {
	const { userId, bookId } = await seed(100);
	expect(await getHistory(db, userId, bookId, { offset: 1 })).toBeNull();
});

test("getProgressOnDay は JST の当日だけ数える", async () => {
	const { userId, bookId } = await seed(100);
	await recordProgress(db, userId, bookId, 7);
	const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
	expect(await getProgressOnDay(db, userId, bookId, today)).toBe(7);
	expect(await getProgressOnDay(db, userId, bookId, "2000-01-01")).toBe(0);
	expect(await getProgressOnDay(db, userId, 999, today)).toBeNull();
});

// ── users / books のその他 ──

test("updateUserName は存在しないユーザーで null (呼び出し側が 500 にする / 既知バグ #1)", async () => {
	expect(await updateUserName(db, 999, "x")).toBeNull();
});

test("updateBook はタイトルとページ数だけ変える", async () => {
	const { userId, bookId } = await seed(100);
	const r = await updateBook(db, userId, bookId, {
		bookTitle: "new",
		bookPages: 200,
	});
	expect(r).toMatchObject({ bookTitle: "new", bookPages: 200, status: "積読" });
	expect(
		await updateBook(db, userId, 999, { bookTitle: "x", bookPages: 1 }),
	).toBeNull();
});

test("username の unique 違反は throw する", async () => {
	await createUser(db, { username: "dup", userMailAddress: null });
	expect(
		createUser(db, { username: "dup", userMailAddress: null }),
	).rejects.toThrow();
});
