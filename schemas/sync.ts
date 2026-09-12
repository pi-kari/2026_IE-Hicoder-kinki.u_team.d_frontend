import { z } from "zod";

/**
 * 同期 (push / pull) の契約。
 *
 * API 契約の正である schemas/openapi.ts とは分けている。あちらは UI が使う
 * 対話 API の形で、こちらは端末とサーバのあいだで行そのものをやり取りする形。
 * upsert の意味論も対話 API とは違うので、混ぜない。
 */

/** 端末が生成する時刻はすべて ISO 文字列で運ぶ。
 *  **サーバは受け取った値をそのまま保存する。**
 *  火曜にオフラインで記録して木曜に送った行が木曜の日付になると、
 *  lib/jst.ts が駆動する日別集計が壊れるため。 */
const IsoDate = z.iso.datetime({ offset: true });

export const UserRowSchema = z.object({
	user_id: z.uuid(),
	username: z.string(),
	updated_at: IsoDate,
	// number_of_books は books_list からの派生値なので運ばない。受け側で数え直す。
	//
	// user_mail_address も運ばない。同期には不要な個人情報で、UI からは一度も
	// 設定されない。これを載せると pull は「user_id さえ分かれば誰でも叩ける
	// メールアドレス取得 API」になってしまう (このアプリに認証は無く、
	// user_id は端末間の引き継ぎのために画面に表示される値)。
});

export const BookRowSchema = z.object({
	book_id: z.uuid(),
	user_id: z.uuid(),
	book_title: z.string(),
	status: z.string(),
	book_pages: z.int(),
	updated_at: IsoDate,
	// total_progress / tree_ratio / tree_state は progress 行からの派生値。
	// 普通のカラムとして同期すると 2 端末でオフライン記録したとき片方が消えるので運ばない。
});

export const ProgressRowSchema = z.object({
	progress_id: z.uuid(),
	book_id: z.uuid(),
	user_id: z.uuid(),
	progress: z.int(),
	created_at: IsoDate,
});

/** outbox の 1 件。op によって payload の形が決まる。 */
export const SyncOpSchema = z.discriminatedUnion("op", [
	z.object({
		id: z.uuid(),
		op: z.literal("user.create"),
		payload: UserRowSchema,
	}),
	z.object({
		id: z.uuid(),
		op: z.literal("book.create"),
		payload: BookRowSchema,
	}),
	z.object({
		id: z.uuid(),
		op: z.literal("progress.record"),
		payload: ProgressRowSchema,
	}),
]);

export const SyncPushBodySchema = z.object({
	ops: z.array(SyncOpSchema).max(500),
});

/** 1 件ごとの結果。
 *  ok       … 反映された (既に同じ id があった場合も含む。再送は冪等)
 *  rejected … 二度と成功しない (参照先が無い等)。呼び出し側は dead letter にする
 *  failed   … 一時的な失敗。再送すべき */
export const SyncOpResultSchema = z.object({
	id: z.uuid(),
	status: z.enum(["ok", "rejected", "failed"]),
	error: z.string().optional(),
});

export const SyncPushResponseSchema = z.object({
	results: z.array(SyncOpResultSchema),
});

export const SyncPullResponseSchema = z.object({
	users: z.array(UserRowSchema),
	books: z.array(BookRowSchema),
	progress: z.array(ProgressRowSchema),
});

export type SyncOp = z.infer<typeof SyncOpSchema>;
export type SyncOpResult = z.infer<typeof SyncOpResultSchema>;
export type SyncPullResponse = z.infer<typeof SyncPullResponseSchema>;
