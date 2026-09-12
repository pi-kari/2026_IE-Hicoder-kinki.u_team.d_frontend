#!/usr/bin/env bun
/**
 * public/sw.js を生成する。
 *
 * Next 16 は manifest は内蔵するが Service Worker は内蔵しない。
 * @serwist/next は webpack プラグインとして注入する作りで、このプロジェクトは
 * Turbopack ビルドなので当てにできない。やることは決まっているので手で書く。
 *
 * 生成にしているのは PGlite のキャッシュ名にパッケージ版数を埋めるため。
 * PGlite の実体は約 9.7MB あり、毎回ネットワークに行かせたくない。
 * かといって固定名でキャッシュすると版を上げたとき古いものを配り続ける。
 */
import { readFileSync, writeFileSync } from "node:fs";

const pgliteVersion = JSON.parse(
	readFileSync("node_modules/@electric-sql/pglite/package.json", "utf8"),
).version as string;

// オフラインで開けるようにしておく画面。
const SHELL = [
	"/",
	"/record",
	"/books",
	"/books-information",
	"/profile",
	"/register",
];

const sw = `// scripts/gen-sw.ts が生成。手で編集しない。
const SHELL_CACHE = "hicoder-shell-v1";
const STATIC_CACHE = "hicoder-static-v1";
const PGLITE_CACHE = "hicoder-pglite-${pgliteVersion}";
const SHELL = ${JSON.stringify(SHELL)};

self.addEventListener("install", (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(SHELL_CACHE);
			// 失敗しても install は通す (1 画面取れなくても他は使える)
			await Promise.allSettled(SHELL.map((url) => cache.add(url)));
			await self.skipWaiting();
		})(),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keep = new Set([SHELL_CACHE, STATIC_CACHE, PGLITE_CACHE]);
			for (const key of await caches.keys()) {
				if (!keep.has(key)) await caches.delete(key);
			}
			await self.clients.claim();
		})(),
	);
});

async function cacheFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	const hit = await cache.match(request);
	if (hit) return hit;
	const res = await fetch(request);
	if (res.ok) cache.put(request, res.clone());
	return res;
}

async function networkFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	try {
		const res = await fetch(request);
		if (res.ok) cache.put(request, res.clone());
		return res;
	} catch (e) {
		const hit = await cache.match(request);
		if (hit) return hit;
		throw e;
	}
}

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	// API は同期専用。キャッシュすると古い状態を「成功」として返してしまう。
	if (url.pathname.startsWith("/api/")) return;

	// 内容ハッシュ付きなので恒久的に安全
	if (url.pathname.startsWith("/_next/static/")) {
		event.respondWith(cacheFirst(request, STATIC_CACHE));
		return;
	}

	// PGlite の wasm / data。約 9.7MB あるので必ずキャッシュから返す。
	if (url.pathname.startsWith("/pglite/")) {
		event.respondWith(cacheFirst(request, PGLITE_CACHE));
		return;
	}

	// App Router のクライアント遷移は HTML ではなく RSC ペイロード
	// (?_rsc= / RSC ヘッダ) を取りに行く。HTML だけキャッシュしても
	// タブを押した瞬間にオフラインで落ちるので、両方キャッシュする。
	const isNavigation = request.mode === "navigate";
	const isRsc = url.searchParams.has("_rsc") || request.headers.has("RSC");
	if (isNavigation || isRsc) {
		event.respondWith(networkFirst(request, SHELL_CACHE));
		return;
	}

	// 画像・フォント等
	event.respondWith(cacheFirst(request, STATIC_CACHE));
});
`;

writeFileSync("public/sw.js", sw);
console.log(`generated public/sw.js (pglite ${pgliteVersion})`);
