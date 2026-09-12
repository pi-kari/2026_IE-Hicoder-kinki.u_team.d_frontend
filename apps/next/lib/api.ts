/**
 * API 呼び出しの薄いラッパ。
 *
 * Expo 時代は 7 箇所が `process.env.EXPO_PUBLIC_BACKEND_URL` からテンプレートリテラルで
 * URL を組み立て、`fetch → res.json() → Schema.parse()` を各自書いていた。
 * UI と API が同一オリジン (:3000) になったので、ベースは相対パスの `/api` で足りる。
 *
 * NOTE: エラー処理の意味は**変えていない**。リトライも `res.ok` チェックも足していない
 * (足すと record の POST でユーザーに見える挙動が変わる)。呼び出し側の try/catch のまま。
 */
import type { ZodType } from "zod";

/** Route Handler は app/api/… にあるので FastAPI 時代の /users は /api/users になる */
export const API_BASE = "/api";

export function apiUrl(path: string): string {
	return `${API_BASE}${path}`;
}

export async function getJson<T>(
	path: string,
	schema: ZodType<T>,
): Promise<T> {
	const res = await fetch(apiUrl(path));
	return schema.parse(await res.json());
}

export async function sendJson<T>(
	method: "POST" | "PUT" | "PATCH",
	path: string,
	body: unknown,
	schema: ZodType<T>,
): Promise<T> {
	const res = await fetch(apiUrl(path), {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return schema.parse(await res.json());
}
