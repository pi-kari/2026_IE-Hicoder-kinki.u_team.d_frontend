import { dumpUser } from "@/lib/domain/sync";
import { uuidParam, withErrorHandling } from "@/lib/http";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/**
 * そのユーザーの行を丸ごと返す。
 *
 * **`since` による差分は取らない。** created_at / updated_at は端末が生成して
 * そのまま転送される値なので、透かしには使えない。端末 A が火曜にオフラインで
 * 記録し木曜に送った場合、端末 B の前回 pull が水曜だと
 * 「created_at > 水曜」で絞った瞬間その行は永久に B へ届かない。
 *
 * 同期対象は 1 ユーザーぶんの数十行で、progress は id 一致で無視、
 * users / books は updated_at の新しい方を採るので、**全件でも構造的に冪等**。
 * 将来どうしても差分にするなら、push ハンドラが now() を打つ synced_at を
 * 足してそれで絞ること。端末の時刻カラムでは絶対に絞らない。
 *
 * GET /api/users/:uid/books は流用できない。toBookResponse の 7 フィールドしか
 * 返さず、user_id も updated_at も progress 行も無いので、履歴の復元も
 * 派生カラムの再計算もできない。
 */
export const GET = withErrorHandling(async (request: Request) => {
	const raw = new URL(request.url).searchParams.get("user_id") ?? "";
	const userId = uuidParam("user_id", raw);
	if (!userId.ok) return userId.response;

	const { users, books, progress } = await dumpUser(db, userId.value);

	return Response.json({
		users: users.map((u) => ({
			user_id: u.userId,
			username: u.username,
			// user_mail_address は返さない (schemas/sync.ts のコメント参照)
			updated_at: u.updatedAt.toISOString(),
		})),
		books: books.map((b) => ({
			book_id: b.bookId,
			user_id: b.userId,
			book_title: b.bookTitle,
			status: b.status,
			book_pages: b.bookPages,
			updated_at: b.updatedAt.toISOString(),
		})),
		progress: progress.map((p) => ({
			progress_id: p.progressId,
			book_id: p.bookId,
			user_id: p.userId,
			progress: p.progress,
			created_at: p.createdAt.toISOString(),
		})),
	});
});
