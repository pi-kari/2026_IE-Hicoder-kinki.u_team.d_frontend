import { z } from "zod";

// リクエストボディの検証スキーマ。
// lib/contract.ts は FastAPI の OpenAPI から生成したものでレスポンス整形用。
// 生成側は user_mail_address が z.union([z.string(), z.unknown()]) のように緩いので、
// リクエスト検証には Pydantic の定義 (app/schemas.py) に忠実な定義をこちらで持つ。

/** schemas.UserCreate: username: str / user_mail_address: str | None = None */
export const UserCreateBody = z.object({
	username: z.string(),
	user_mail_address: z.string().nullish(),
});

/** schemas.UserNameUpdate: username: str */
export const UserNameUpdateBody = z.object({
	username: z.string(),
});

/** schemas.BookCreate: book_title: str / status: str / book_pages: int
 *  NOTE: status は受け取るが、FastAPI 側は無視して DB 既定値 "積読" を使う（既知バグ #3）。
 *  Phase 1 では再現するため、この値は書き込まない。 */
export const BookCreateBody = z.object({
	book_title: z.string(),
	status: z.string(),
	book_pages: z.int(),
});

/** schemas.ProgressRequestSchema: pages_read: int */
export const ProgressRequestBody = z.object({
	pages_read: z.int(),
});
