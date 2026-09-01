import type { z } from "zod";

/** FastAPI の HTTPException が返すボディ: {"detail": "..."} */
export function errorJson(message: string, status: number) {
	return Response.json({ detail: message }, { status });
}

export const userNotFound = () => errorJson("User not found", 404);
export const bookNotFound = () => errorJson("Book not found", 404);

/** FastAPI (Starlette の ServerErrorMiddleware) は未処理例外に対して
 *  "Internal Server Error" という plain text を返す。JSON ではない。 */
export const internalServerError = () =>
	new Response("Internal Server Error", {
		status: 500,
		headers: { "content-type": "text/plain; charset=utf-8" },
	});

/**
 * 全ルートハンドラをこれで包む。
 *
 * FastAPI では未処理例外がそのまま 500 plain text になる。Next のハンドラで
 * 例外を投げっぱなしにすると next dev がスタック入りの開発用ボディを返して
 * 内容が非決定的になるため、明示的に捕まえて同じ応答に揃える。
 *
 * これにより Phase 1 で再現対象になっている 3 つの 500 が
 * 「投げれば FastAPI と一致する」状態になる:
 *   - PATCH /users/{id} が存在しないユーザに None を返す (既知バグ #1)
 *   - PUT /users の username 重複 (unique 違反)
 *   - POST .../progress の book_pages = 0 での int4 オーバーフロー (既知バグ #4)
 */
export function withErrorHandling<A extends unknown[]>(
	handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
	return async (...args: A): Promise<Response> => {
		try {
			return await handler(...args);
		} catch (error) {
			console.error(error);
			return internalServerError();
		}
	};
}

/** Pydantic の 422 ボディ: {"detail": [{loc, msg, type}, ...]}
 *  schemas/openapi.ts の HTTPValidationError / ValidationError に対応する。
 *  Pydantic が付ける input / url キーは省いている (スキーマ上も任意で、読む呼び出し元はいない)。 */
export type ValidationIssue = {
	loc: (string | number)[];
	msg: string;
	type: string;
};

export function unprocessable(issues: ValidationIssue[]) {
	return Response.json({ detail: issues }, { status: 422 });
}

type ParamResult =
	| { ok: true; value: number }
	| { ok: false; response: Response };

/** FastAPI は非整数のパスパラメータに 422 を返す。ステータスと detail 配列の形を合わせる。 */
export function intParam(name: string, raw: string): ParamResult {
	if (!/^-?\d+$/.test(raw)) {
		return {
			ok: false,
			response: unprocessable([
				{
					loc: ["path", name],
					msg: "Input should be a valid integer, unable to parse string as an integer",
					type: "int_parsing",
				},
			]),
		};
	}
	return { ok: true, value: Number(raw) };
}

/** クエリパラメータの整数。未指定なら fallback。FastAPI と同じく不正値は 422。 */
export function intQuery(
	name: string,
	raw: string | null,
	fallback: number,
): ParamResult {
	if (raw === null) return { ok: true, value: fallback };
	if (!/^-?\d+$/.test(raw)) {
		return {
			ok: false,
			response: unprocessable([
				{
					loc: ["query", name],
					msg: "Input should be a valid integer, unable to parse string as an integer",
					type: "int_parsing",
				},
			]),
		};
	}
	return { ok: true, value: Number(raw) };
}

type BodyResult<T> = { ok: true; data: T } | { ok: false; response: Response };

export async function jsonBody<T>(
	request: Request,
	schema: z.ZodType<T>,
): Promise<BodyResult<T>> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return {
			ok: false,
			response: unprocessable([
				{ loc: ["body"], msg: "JSON decode error", type: "json_invalid" },
			]),
		};
	}
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		return {
			ok: false,
			response: unprocessable(
				parsed.error.issues.map((issue) => ({
					loc: [
						"body",
						...issue.path.map((p) =>
							typeof p === "symbol" ? String(p) : (p as string | number),
						),
					],
					msg: issue.message,
					type: issue.code,
				})),
			),
		};
	}
	return { ok: true, data: parsed.data };
}
