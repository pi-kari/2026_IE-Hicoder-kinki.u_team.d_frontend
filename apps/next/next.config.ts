import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// bun.lock がリポジトリルート (Expo) と ここ の 2 箇所にあるため、指定しないと
	// Turbopack が Expo 側のリポジトリルートを workspace root と誤認して監視範囲を広げる。
	// NOTE: Expo を撤去してルートに昇格したら不要になるので消すこと。
	turbopack: {
		root: __dirname,

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

	// FastAPI の CORSMiddleware と等価:
	//   allow_origins=["*"], allow_credentials=False,
	//   allow_methods=["*"], allow_headers=["*"]
	//
	// UI が同一オリジンになったのでブラウザからは不要だが、
	// 外部ツールやネイティブから叩く余地を残すコストはゼロなので維持する。
	async headers() {
		return [
			{
				source: "/api/:path*",
				headers: [
					{ key: "Access-Control-Allow-Origin", value: "*" },
					{
						key: "Access-Control-Allow-Methods",
						value: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
					},
					{ key: "Access-Control-Allow-Headers", value: "*" },
					{ key: "Access-Control-Max-Age", value: "600" },
				],
			},
		];
	},
};

export default nextConfig;
