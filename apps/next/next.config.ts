import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// bun.lock がリポジトリルート (Expo) と ここ の 2 箇所にあるため、指定しないと
	// Turbopack が Expo 側のリポジトリルートを workspace root と誤認して監視範囲を広げる。
	turbopack: { root: __dirname },

	// next dev が AGENTS.md / CLAUDE.md を自動生成するのを止める。
	// チームのリポジトリに意図しないファイルが増えるのを避けるため。
	agentRules: false,

	// FastAPI の CORSMiddleware と等価:
	//   allow_origins=["*"], allow_credentials=False,
	//   allow_methods=["*"], allow_headers=["*"]
	// Access-Control-Allow-Headers の "*" は credentials を使わない場合のみ有効で、
	// 今回はまさにその条件 (呼び出し側は credentials: "include" を送っていない)。
	//
	// preflight について: Next は OPTIONS を export していない route handler に対して
	// OPTIONS を自動実装する。headers() はルーティング層で付くのでその自動応答にも乗る。
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
