import { applyProgress, upsertBook, upsertUser } from "@/lib/domain/sync";
import { jsonBody, withErrorHandling } from "@/lib/http";
import { db } from "@/lib/server/db";
import {
	type SyncOp,
	type SyncOpResult,
	SyncPushBodySchema,
} from "@/schemas/sync";

export const dynamic = "force-dynamic";

/**
 * 端末の outbox をサーバへ反映する。
 *
 * 対話 API (PUT /users/:id/books 等) を流用しない理由:
 *   - 往復が 1 回で済む
 *   - FK の順序が 1 トランザクション内で保証される
 *   - upsert の意味論が対話 API と違うので、その違いをこの 1 ファイルに閉じ込められる
 *     (既存の 5 本は無傷のまま仕様テストに使える)
 *
 * **op ごとに SAVEPOINT を張る。** 平坦な 1 トランザクションだと 1 件の失敗が
 * バッチ全体を巻き戻し、withErrorHandling がプレーンテキストの 500 を返すので、
 * 端末はどれが失敗したか分からないまま同じバッチを永久に再送し続ける。
 */
export const POST = withErrorHandling(async (request: Request) => {
	const body = await jsonBody(request, SyncPushBodySchema);
	if (!body.ok) return body.response;

	const results: SyncOpResult[] = [];

	await db.transaction(async (tx) => {
		for (const op of body.data.ops) {
			try {
				// ネストした transaction は SAVEPOINT になる (実測で確認済み)。
				// 中が失敗しても外側のトランザクションは生き残る。
				await tx.transaction(async (sp) => {
					const outcome = await applyOp(sp, op);
					if (!outcome.ok) throw new RejectedOp(outcome.reason);
				});
				results.push({ id: op.id, status: "ok" });
			} catch (error) {
				if (error instanceof RejectedOp) {
					// 参照先が無い等、再送しても成功しない
					results.push({ id: op.id, status: "rejected", error: error.message });
				} else {
					// 一時的な失敗。端末は再送する
					console.error("sync push op failed", op.op, op.id, error);
					results.push({
						id: op.id,
						status: "failed",
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}
		}
	});

	return Response.json({ results });
});

class RejectedOp extends Error {}

type Outcome = { ok: true } | { ok: false; reason: string };

async function applyOp(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	op: SyncOp,
): Promise<Outcome> {
	switch (op.op) {
		case "user.create":
			await upsertUser(tx, {
				userId: op.payload.user_id,
				username: op.payload.username,
				userMailAddress: op.payload.user_mail_address,
				updatedAt: new Date(op.payload.updated_at),
			});
			return { ok: true };

		case "book.create": {
			const r = await upsertBook(tx, {
				bookId: op.payload.book_id,
				userId: op.payload.user_id,
				bookTitle: op.payload.book_title,
				status: op.payload.status,
				bookPages: op.payload.book_pages,
				updatedAt: new Date(op.payload.updated_at),
			});
			return r.ok ? { ok: true } : { ok: false, reason: "User not found" };
		}

		case "progress.record": {
			const r = await applyProgress(tx, {
				progressId: op.payload.progress_id,
				bookId: op.payload.book_id,
				userId: op.payload.user_id,
				pagesRead: op.payload.progress,
				createdAt: new Date(op.payload.created_at),
			});
			return r.ok ? { ok: true } : { ok: false, reason: "Book not found" };
		}
	}
}
