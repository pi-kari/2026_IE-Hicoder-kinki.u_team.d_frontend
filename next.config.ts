import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	turbopack: {
		// NOTE: `react-native` の alias は**張らない**。
		// Tamagui の web ビルドは react-native を import しない (するのは *.native.js だけ) ので
		// 不要であり、張らずにおけば誰かが誤って import したとき
		// 「Module not found: react-native」でビルドが落ちて気づける。
		//
		// NOTE: 公式ガイドの `experimental.turbo.resolveAlias` は古いキー。
		// Next 16 では turbopack がトップレベルに昇格している
		// (next/dist/server/config-shared.d.ts の `turbopack?: TurbopackOptions`)。
		resolveAlias: {
			"react-native-svg": "@tamagui/react-native-svg",

			// PGlite の実体は public/pglite/ から素の ESM として読む
			// (Turbopack はこのパッケージをバンドルすると本番ビルドで壊す)。
			// drizzle-orm/pglite が @electric-sql/pglite を import しているので、
			// 何もしないと壊れる方がバンドルに戻ってくる。必要なのは OID 定数だけ。
			"@electric-sql/pglite": "./lib/local/pglite-stub.ts",
		},
	},

	// これらは ESM / Flow 混じりのソースを配るので Next 側でトランスパイルする。
	transpilePackages: [
		"tamagui",
		"@tamagui/config",
		"@tamagui/toast",
		"@tamagui/lucide-icons-2",
		"@tamagui/next-theme",
	],

	// next dev が AGENTS.md / CLAUDE.md を自動生成するのを止める。
	// チームのリポジトリに意図しないファイルが増えるのを避けるため。
	agentRules: false,

	// NOTE: CORS ヘッダは**付けない**。
	//
	// 以前は FastAPI の CORSMiddleware と等価の `Access-Control-Allow-Origin: *`
	// を返していたが、認証を cookie で行うようになったので意味が変わった。
	// ブラウザは credentials 付きのリクエストに対して `*` を受け付けないので
	// 役に立たないうえ、「どこからでも叩ける」という誤解を招く。
	// UI は同一オリジンなので CORS そのものが不要。
	//
	// 別オリジンから叩く必要が出たら、`*` ではなく具体的なオリジンを列挙し、
	// `Access-Control-Allow-Credentials: true` と併せて設定すること。
};

export default nextConfig;
