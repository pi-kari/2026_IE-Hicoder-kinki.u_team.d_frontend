import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { transferCodes, userCredentials, userSessions } from "../schema";
import { db } from "./db";

/**
 * 認証。
 *
 * このアプリにログイン画面は無く、オフラインでの新規登録を残したいので、
 * 「登録時に端末が秘密を作り、初回同期でその秘密を提示して user_id を確保する」
 * 方式にしている。秘密をサーバ発行にすると登録がオンライン必須になる。
 *
 * 確保したあとは httpOnly cookie のセッションで認証する。
 * **user_id は資格情報として扱わない** (引き継ぎのために画面に出す値なので)。
 *
 * 秘密もセッショントークンも 256bit の乱数なので、パスワードと違って
 * 総当たりの余地がない。よって遅いハッシュ (bcrypt 等) は不要で、
 * DB 流出時に原文を守れれば十分なため SHA-256 を使う。
 */

export const SESSION_COOKIE = "hicoder_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 年。端末を覚えておく用途
const TRANSFER_TTL_MS = 10 * 60 * 1000; // 引き継ぎコードは 10 分で失効

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return Buffer.from(digest).toString("hex");
}

/** ハッシュ同士の比較。長さが同じなので timingSafeEqual をそのまま使える。 */
function sameHash(a: string, b: string): boolean {
	const x = Buffer.from(a, "hex");
	const y = Buffer.from(b, "hex");
	return x.length === y.length && timingSafeEqual(x, y);
}

function randomToken(): string {
	return randomBytes(32).toString("base64url");
}

/** 人が読み上げ・入力しやすい引き継ぎコード。紛らわしい文字は使わない。 */
function randomTransferCode(): string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // I,O,0,1 を除く
	const bytes = randomBytes(10);
	const code = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
	return `${code.slice(0, 5)}-${code.slice(5)}`;
}

function sessionCookie(token: string): string {
	const parts = [
		`${SESSION_COOKIE}=${token}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${SESSION_MAX_AGE}`,
	];
	// 開発は http なので Secure を付けると cookie が保存されない
	if (process.env.NODE_ENV === "production") parts.push("Secure");
	return parts.join("; ");
}

function clearedCookie(): string {
	return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

async function createSession(userId: string): Promise<string> {
	const token = randomToken();
	await db
		.insert(userSessions)
		.values({ tokenHash: await sha256(token), userId });
	return token;
}

function readCookie(request: Request, name: string): string | null {
	const header = request.headers.get("cookie");
	if (!header) return null;
	for (const part of header.split(";")) {
		const [k, ...rest] = part.trim().split("=");
		if (k === name) return rest.join("=");
	}
	return null;
}

/** cookie のセッションから user_id を解決する。無ければ null。 */
export async function sessionUserId(request: Request): Promise<string | null> {
	const token = readCookie(request, SESSION_COOKIE);
	if (!token) return null;

	const [row] = await db
		.select({ userId: userSessions.userId })
		.from(userSessions)
		.where(eq(userSessions.tokenHash, await sha256(token)))
		.limit(1);
	if (!row) return null;

	// 最終利用時刻の更新は失敗しても認証そのものには影響しない
	void db
		.update(userSessions)
		.set({ lastSeenAt: sql`now()` })
		.where(eq(userSessions.tokenHash, await sha256(token)))
		.catch(() => {});

	return row.userId;
}

export type Authed =
	| { ok: true; userId: string }
	| { ok: false; response: Response };

const unauthorized = () =>
	Response.json({ detail: "Not authenticated" }, { status: 401 });
const forbidden = () => Response.json({ detail: "Forbidden" }, { status: 403 });

/** ログイン必須のハンドラで使う。 */
export async function requireSession(request: Request): Promise<Authed> {
	const userId = await sessionUserId(request);
	if (!userId) return { ok: false, response: unauthorized() };
	return { ok: true, userId };
}

/** パスやボディの user_id が、セッションの持ち主と一致することを確かめる。
 *  一致しなければ他人のデータを触ろうとしている。 */
export async function requireOwner(
	request: Request,
	targetUserId: string,
): Promise<Authed> {
	const session = await requireSession(request);
	if (!session.ok) return session;
	if (session.userId !== targetUserId) {
		return { ok: false, response: forbidden() };
	}
	return session;
}

/**
 * 端末が持つ秘密で user_id を確保し、セッションを張る。
 *
 * まだ誰も確保していなければ先着で確保する。既に確保済みなら秘密が一致した
 * ときだけセッションを張る。user_id は端末内で生成され、確保するまで
 * ネットワークに出ないので、他人に先回りされることはない。
 */
export async function claim(
	userId: string,
	secret: string,
): Promise<{ ok: true; cookie: string } | { ok: false; response: Response }> {
	const secretHash = await sha256(secret);

	const [existing] = await db
		.select({ secretHash: userCredentials.secretHash })
		.from(userCredentials)
		.where(eq(userCredentials.userId, userId))
		.limit(1);

	if (!existing) {
		// 競合しても DO NOTHING で先着が残る。負けた側は下の比較で弾かれる。
		await db
			.insert(userCredentials)
			.values({ userId, secretHash })
			.onConflictDoNothing({ target: userCredentials.userId });

		const [after] = await db
			.select({ secretHash: userCredentials.secretHash })
			.from(userCredentials)
			.where(eq(userCredentials.userId, userId))
			.limit(1);
		if (!after || !sameHash(after.secretHash, secretHash)) {
			return { ok: false, response: forbidden() };
		}
	} else if (!sameHash(existing.secretHash, secretHash)) {
		return { ok: false, response: forbidden() };
	}

	return { ok: true, cookie: sessionCookie(await createSession(userId)) };
}

/** 2 台目に渡す引き継ぎコードを発行する。 */
export async function issueTransferCode(
	userId: string,
): Promise<{ code: string; expiresAt: Date }> {
	// 古いものを掃除しておく (放っておくと溜まる一方なので)
	await db.delete(transferCodes).where(lt(transferCodes.expiresAt, sql`now()`));

	const code = randomTransferCode();
	const expiresAt = new Date(Date.now() + TRANSFER_TTL_MS);
	await db
		.insert(transferCodes)
		.values({ codeHash: await sha256(code), userId, expiresAt });

	return { code, expiresAt };
}

/** 引き継ぎコードを使ってこの端末にセッションを張る。1 回きり。 */
export async function redeemTransferCode(
	code: string,
): Promise<
	| { ok: true; userId: string; cookie: string }
	| { ok: false; response: Response }
> {
	const codeHash = await sha256(code.trim().toUpperCase());

	// 使用済みにできた場合だけ有効。取り合いになっても 1 回しか通らない。
	const consumed = await db
		.update(transferCodes)
		.set({ usedAt: sql`now()` })
		.where(
			and(
				eq(transferCodes.codeHash, codeHash),
				isNull(transferCodes.usedAt),
				gt(transferCodes.expiresAt, sql`now()`),
			),
		)
		.returning({ userId: transferCodes.userId });

	const row = consumed[0];
	if (!row) {
		return {
			ok: false,
			response: Response.json(
				{ detail: "Invalid or expired transfer code" },
				{ status: 400 },
			),
		};
	}

	return {
		ok: true,
		userId: row.userId,
		cookie: sessionCookie(await createSession(row.userId)),
	};
}

/** この端末のセッションだけ破棄する。 */
export async function endSession(request: Request): Promise<string> {
	const token = readCookie(request, SESSION_COOKIE);
	if (token) {
		await db
			.delete(userSessions)
			.where(eq(userSessions.tokenHash, await sha256(token)));
	}
	return clearedCookie();
}
