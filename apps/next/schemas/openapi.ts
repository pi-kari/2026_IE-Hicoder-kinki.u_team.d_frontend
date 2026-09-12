// もとは FastAPI の OpenAPI から `bun run generate:schema` で生成していたが、
// そのバックエンドは廃止済み（API は apps/next に移行）。生成スクリプトも削除したので
// 以降は手動保守する。
//
// API 契約の正はこのファイルと apps/next/lib/contract.ts（同内容のコピー）。
// エンドポイントを変更したら両方を更新すること。
// Phase 2 でワークスペース化する際に共有パッケージへ統合する。

import { z } from "zod";

export const BookCreateSchema = z.object({
	book_title: z.string(),
	status: z.string(),
	book_pages: z.number(),
});

export const BookResponseSchema = z.object({
	book_id: z.number(),
	status: z.string(),
	book_title: z.string(),
	book_pages: z.number(),
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
	username: z.string(),
	user_mail_address: z.union([z.string(), z.unknown()]).optional(),
});

export const UserNameUpdateSchema = z.object({
	username: z.string(),
});

export const UserResponseSchema = z.object({
	user_id: z.number(),
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
