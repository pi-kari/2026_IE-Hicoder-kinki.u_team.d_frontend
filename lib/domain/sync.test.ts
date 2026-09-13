import { beforeEach, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../schema";
import { uuidv7 } from "../uuid";
import { getBook, listBooks } from "./books";
import type { DomainDb } from "./db";
import { getHistory } from "./progress";
import {
	applyProgress,
	dumpUser,
	recomputeAll,
	upsertBook,
	upsertUser,
} from "./sync";
import { SCHEMA_DDL } from "./test-ddl";
import { getUser } from "./users";

/**
 * 同期の適用ロジック。
 *
 * 2 つの PGlite インスタンスを「端末 A」「サーバ」に見立てて、
 * 実際に行を往復させて確かめる。lib/domain/* は db ハンドルの純関数なので、
 * 同じコードが両側で動くことがそのまま検証になる。
 */
const ddl = SCHEMA_DDL;

async function makeDb(): Promise<{ db: DomainDb; client: PGlite }> {
	const client = new PGlite();
	await client.exec(ddl);
	return { db: drizzle(client, { schema }), client };
}

// PGlite の起動は重いので使い回し、テストごとに TRUNCATE する。
const a = await makeDb();
const b = await makeDb();
const server = await makeDb();

const TRUNCATE = "TRUNCATE progress, books_list, users CASCADE;";
beforeEach(async () => {
	for (const d of [a, b, server]) await d.client.exec(TRUNCATE);
});

const now = () => new Date();

/** ある DB の内容をもう一方へ丸ごと流し込む (push / pull と同じ順序)。 */
async function transfer(from: DomainDb, to: DomainDb, userId: string) {
	const dump = await dumpUser(from, userId);
	const touched = new Set<string>();
	for (const u of dump.users) {
		await upsertUser(to, {
			userId: u.userId,
			username: u.username,
			updatedAt: u.updatedAt,
		});
	}
	for (const bk of dump.books) {
		await upsertBook(to, {
			bookId: bk.bookId,
			userId: bk.userId,
			bookTitle: bk.bookTitle,
			status: bk.status,
			bookPages: bk.bookPages,
			updatedAt: bk.updatedAt,
		});
		touched.add(bk.bookId);
	}
	for (const p of dump.progress) {
		await applyProgress(to, {
			progressId: p.progressId,
			bookId: p.bookId,
			userId: p.userId,
			pageReached: p.progress,
			createdAt: p.createdAt,
		});
		touched.add(p.bookId);
	}
	await recomputeAll(to, userId, [...touched], now());
}

async function seedUser(db: DomainDb, userId: string, username = "u") {
	await upsertUser(db, {
		userId,
		username,
		updatedAt: now(),
	});
}

test("再送しても重複しない (progress は id 一致で無視)", async () => {
	const userId = uuidv7();
	const bookId = uuidv7();
	const progressId = uuidv7();
	await seedUser(server.db, userId);
	await upsertBook(server.db, {
		bookId,
		userId,
		bookTitle: "t",
		status: "積読",
		bookPages: 100,
		updatedAt: now(),
	});

	const input = {
		progressId,
		bookId,
		userId,
		pageReached: 30,
		createdAt: now(),
	};
	await applyProgress(server.db, input);
	await applyProgress(server.db, input);
	await applyProgress(server.db, input);

	const h = await getHistory(server.db, userId, bookId, {
		limit: 20,
		offset: 0,
	});
	expect(h?.history.length).toBe(1);
	expect(h?.totalProgress).toBe(30);
});

test("参照先が無ければ適用しない (呼び出し側が rejected にする)", async () => {
	const userId = uuidv7();
	// ユーザーが未着の本
	expect(
		await upsertBook(server.db, {
			bookId: uuidv7(),
			userId,
			bookTitle: "t",
			status: "積読",
			bookPages: 10,
			updatedAt: now(),
		}),
	).toEqual({ ok: false });

	// 本が未着の進捗
	await seedUser(server.db, userId);
	expect(
		await applyProgress(server.db, {
			progressId: uuidv7(),
			bookId: uuidv7(),
			userId,
			pageReached: 1,
			createdAt: now(),
		}),
	).toEqual({ ok: false });
});

test("2 端末が同じ本にオフラインで記録すると進んだ方に揃う", async () => {
	const userId = uuidv7();
	const bookId = uuidv7();
	for (const d of [a.db, b.db, server.db]) {
		await seedUser(d, userId);
		await upsertBook(d, {
			bookId,
			userId,
			bookTitle: "t",
			status: "読書中",
			bookPages: 100,
			updatedAt: now(),
		});
	}

	// それぞれオフラインで記録 (値は「読み終わったページ番号」)
	await applyProgress(a.db, {
		progressId: uuidv7(),
		bookId,
		userId,
		pageReached: 30,
		createdAt: now(),
	});
	await applyProgress(b.db, {
		progressId: uuidv7(),
		bookId,
		userId,
		pageReached: 70,
		createdAt: now(),
	});

	// 両方オンラインに戻る
	await transfer(a.db, server.db, userId);
	await transfer(b.db, server.db, userId);
	await transfer(server.db, a.db, userId);
	await transfer(server.db, b.db, userId);

	// どの端末から見ても進んだ方の 70 に揃う。
	// **合算してはいけない** (30 + 70 = 100 は、同じ 30 ページを二重に数えている)。
	for (const d of [a.db, b.db, server.db]) {
		const book = await getBook(d, userId, bookId);
		expect(book).toMatchObject({
			totalProgress: 70,
			treeRatio: 70,
			treeState: 2,
		});
	}
});

test("片方で追加した本がもう片方に出る。冊数も数え直される", async () => {
	const userId = uuidv7();
	await seedUser(a.db, userId);
	await seedUser(b.db, userId);
	await seedUser(server.db, userId);

	await upsertBook(a.db, {
		bookId: uuidv7(),
		userId,
		bookTitle: "A の本",
		status: "積読",
		bookPages: 10,
		updatedAt: now(),
	});
	await upsertBook(b.db, {
		bookId: uuidv7(),
		userId,
		bookTitle: "B の本",
		status: "積読",
		bookPages: 20,
		updatedAt: now(),
	});

	await transfer(a.db, server.db, userId);
	await transfer(b.db, server.db, userId);
	await transfer(server.db, a.db, userId);

	const titles = (await listBooks(a.db, userId)).map((x) => x.bookTitle);
	expect(titles.sort()).toEqual(["A の本", "B の本"]);
	// number_of_books は同期せず数え直す
	expect((await getUser(a.db, userId))?.numberOfBooks).toBe(2);
});

test("可変な行は updated_at が新しい方が勝つ (到着順ではない)", async () => {
	const userId = uuidv7();
	const older = new Date("2026-09-01T00:00:00Z");
	const newer = new Date("2026-09-02T00:00:00Z");

	await upsertUser(server.db, {
		userId,
		username: "新しい方",
		updatedAt: newer,
	});
	// 後から届いた古い編集は負ける
	await upsertUser(server.db, {
		userId,
		username: "古い方",
		updatedAt: older,
	});

	expect((await getUser(server.db, userId))?.username).toBe("新しい方");
});

test("派生カラムは運ばずに受け側で数え直す", async () => {
	const userId = uuidv7();
	const bookId = uuidv7();
	await seedUser(a.db, userId);
	await upsertBook(a.db, {
		bookId,
		userId,
		bookTitle: "t",
		status: "読書中",
		bookPages: 200,
		updatedAt: now(),
	});
	await applyProgress(a.db, {
		progressId: uuidv7(),
		bookId,
		userId,
		pageReached: 50,
		createdAt: now(),
	});

	// dump には派生カラムが含まれていてもよいが、受け側は必ず数え直す
	await seedUser(server.db, userId);
	await transfer(a.db, server.db, userId);

	expect(await getBook(server.db, userId, bookId)).toMatchObject({
		totalProgress: 50,
		treeRatio: 25,
		treeState: 1,
	});
});

test("オフラインで記録した日付が同期後も保たれる", async () => {
	const userId = uuidv7();
	const bookId = uuidv7();
	await seedUser(a.db, userId);
	await upsertBook(a.db, {
		bookId,
		userId,
		bookTitle: "t",
		status: "読書中",
		bookPages: 100,
		updatedAt: now(),
	});

	// 火曜に記録した (JST 12:00)
	const tuesday = new Date("2026-09-08T03:00:00Z");
	await applyProgress(a.db, {
		progressId: uuidv7(),
		bookId,
		userId,
		pageReached: 5,
		createdAt: tuesday,
	});

	// 木曜に同期した
	await seedUser(server.db, userId);
	await transfer(a.db, server.db, userId);

	const dump = await dumpUser(server.db, userId);
	expect(dump.progress[0].createdAt.toISOString()).toBe(tuesday.toISOString());
});
