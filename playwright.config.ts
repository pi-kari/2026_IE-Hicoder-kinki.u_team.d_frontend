import { defineConfig } from "@playwright/test";

const port = 3838;

export default defineConfig({
	testDir: "tests",
	reporter: [["list"]],

	use: {
		baseURL: `http://localhost:${port}`,
	},

	// 旧構成は `expo export --platform web && serve dist` だった。
	// Next に移ったのでビルドしてそのまま起動する。
	webServer: {
		command: `bun run build && bun run start --port ${port}`,
		url: `http://localhost:${port}`,
		// **既に 3838 で動いているサーバがあると、ビルドを丸ごと飛ばして
		// それを使う。** 前の実行のサーバが残っていると、書いたばかりのコードでは
		// なく古いビルドをテストすることになり、しかも黙って通ったり落ちたりする
		// (実際に何度も誤診した)。挙動がおかしいときはまず
		// `ps -eo pid,args | grep next-server` を見て、残っていたら落とすこと。
		reuseExistingServer: true,
		timeout: 180_000,
	},

	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	maxFailures: 1,
	// ほぼ全てのテストが端末内 DB (PGlite / WASM) の起動を待つ。初回は 3〜8 秒、
	// 2 台目の context を作るテストはそれを 2 回挟む。30 秒だと**機械が混んでいる
	// ときだけ落ちる**ので、実質の待ち時間に見合う値にする
	// (個々の expect は 30_000 を明示しているので、ここは上限の話)。
	timeout: 60_000,
});
