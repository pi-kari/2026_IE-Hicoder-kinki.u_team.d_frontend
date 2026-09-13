// もとは FastAPI の OpenAPI から生成していたが、そのバックエンドは廃止済み
// (API は同リポジトリの app/api/** に移行)。生成スクリプトも無いので手動保守する。
//
// API 契約の正はこのファイル 1 つ。UI (app/**, components/**) とサーバ側の
// lib/serialize.ts が同じものを参照する。
// 以前は lib/contract.ts に同内容のコピーがあったが、単一アプリになったので統合した。

import { z } from "zod";

export const BookCreateSchema = z.object({
	// 主キーはクライアント生成 (uuidv7)。サーバに採番させると、その id が
	// クライアントに伝わらず同期の再送が重複行を作る。
	book_id: z.uuid(),
	book_title: z.string(),
	status: z.string(),
	book_pages: z.number(),
	// バーコード登録で入る ISBN-13。手入力の本には無い。
	isbn: z.string().nullable().optional(),
});

export const BookResponseSchema = z.object({
	book_id: z.uuid(),
	status: z.string(),
	book_title: z.string(),
	book_pages: z.number(),
	// UI は表紙を端末内の book_covers から ISBN で引くので、ここに載せる。
	isbn: z.string().nullable(),
	total_progress: z.number(),
	tree_ratio: z.number(),
	tree_state: z.number(),
});

export const ProgressRequestSchemaSchema = z.object({
	pages_read: z.number(),
});

export const ProgressUpdateResponseSchema = z.object({
	total_progress: z.number(),
	tree_ratio: z.number(),
	tree_state: z.number(),
});

export const ReadingHistorySchema = z.object({
	date: z.string(),
	progress: z.number(),
});

export const ResponseTreeStateSchema = z.object({
	tree_ratio: z.number(),
	tree_state: z.number(),
});

export const TodayProgressResponseSchema = z.object({
	progress: z.number(),
});

export const UserCreateSchema = z.object({
	user_id: z.uuid(),
	username: z.string(),
	user_mail_address: z.union([z.string(), z.unknown()]).optional(),
});

export const UserNameUpdateSchema = z.object({
	username: z.string(),
});

export const UserResponseSchema = z.object({
	user_id: z.uuid(),
	username: z.string(),
	number_of_books: z.number(),
});

export const ValidationErrorSchema = z.object({
	loc: z.array(z.union([z.string(), z.number()])),
	msg: z.string(),
	type: z.string(),
	input: z.unknown().optional(),
	ctx: z.object({}).optional(),
});

export const HTTPValidationErrorSchema = z.object({
	detail: z.array(ValidationErrorSchema).optional(),
});

export const ProgressResponseSchema = z.object({
	total_progress: z.number(),
	history: z.array(ReadingHistorySchema),
});
