"use client";

import { sql } from "drizzle-orm";
import type { DomainDb } from "../domain/db";

/**
 * この端末がアカウントを確保するための秘密。
 *
 * サーバ発行にすると登録がオンライン必須になり、「オフラインのまま新規登録
 * できる」という性質が壊れる。そこで端末が 256bit の乱数を作り、初めて
 * オンラインになったときにそれを提示して user_id を確保する。
 *
 * 置き場所は端末内 DB (`_local_meta`)。localStorage でも危険度は同じだが、
 * ローカルの状態はここに集約しておく。**サーバへは確保のとき以外送らない。**
 * 以後の認証は httpOnly cookie のセッションで行う。
 */

const KEY = "device_secret";

async function rows<T>(
	db: DomainDb,
	query: Parameters<DomainDb["execute"]>[0],
) {
	const res = (await db.execute(query)) as { rows?: T[] } | T[];
	return (Array.isArray(res) ? res : (res.rows ?? [])) as T[];
}

function generate(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/** 無ければ作って返す。1 端末につき 1 つ。 */
export async function deviceSecret(db: DomainDb): Promise<string> {
	const found = await rows<{ value: string }>(
		db,
		sql`select value from _local_meta where key = ${KEY}`,
	);
	if (found[0]) return found[0].value;

	const secret = generate();
	await db.execute(
		sql`insert into _local_meta (key, value) values (${KEY}, ${secret})
		    on conflict (key) do nothing`,
	);

	// 競合した場合に備えて、入った値を読み直して返す
	const after = await rows<{ value: string }>(
		db,
		sql`select value from _local_meta where key = ${KEY}`,
	);
	return after[0]?.value ?? secret;
}

/**
 * 2 台目として合流したときに使う。
 *
 * 引き継ぎコードで入った端末はアカウントの秘密を知らない (渡していない)。
 * セッション cookie だけが資格情報になるので、この端末では確保を試みない。
 */
export async function markJoinedDevice(db: DomainDb): Promise<void> {
	await db.execute(
		sql`insert into _local_meta (key, value) values ('joined_device', 'true')
		    on conflict (key) do update set value = 'true'`,
	);
}

export async function isJoinedDevice(db: DomainDb): Promise<boolean> {
	const found = await rows<{ value: string }>(
		db,
		sql`select value from _local_meta where key = 'joined_device'`,
	);
	return found[0]?.value === "true";
}
