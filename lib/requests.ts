import { z } from "zod";

// リクエストボディの検証スキーマ。
// schemas/openapi.ts は FastAPI の OpenAPI から生成したものでレスポンス整形用。
// 生成側は user_mail_address が z.union([z.string(), z.unknown()]) のように緩いので、
// リクエスト検証には Pydantic の定義 (app/schemas.py) に忠実な定義をこちらで持つ。

/** schemas.UserCreate: username: str / user_mail_address: str | None = None
 *  user_id はクライアント生成の uuidv7。オフラインでも登録できる必要があるため
 *  サーバ採番には戻さない。 */
export const UserCreateBody = z.object({
	user_id: z.uuid(),
	username: z.string(),
	user_mail_address: z.string().nullish(),
});

/** schemas.UserNameUpdate: username: str */
export const UserNameUpdateBody = z.object({
	username: z.string(),
});

/** schemas.BookCreate: book_title: str / status: str / book_pages: int
 *  book_id はクライアント生成の uuidv7。
 *  status は既知バグ #3 を直したので、今は実際に書き込まれる。 */
export const BookCreateBody = z.object({
	book_id: z.uuid(),
	book_title: z.string(),
	status: z.string(),
	book_pages: z.int(),
	// バーコード登録で入る ISBN-13。手入力の本には無いので任意。
	isbn: z.string().nullable().optional(),
});

/** 更新系は id をパスから取るのでボディには持たない。 */
export const BookUpdateBody = z.object({
	book_title: z.string(),
	status: z.string(),
	book_pages: z.int(),
});

/** schemas.ProgressRequestSchema: page_reached: int
 *  読んだページ数ではなく、そのとき読み終わったページ番号。 */
export const ProgressRequestBody = z.object({
	page_reached: z.int(),
});
