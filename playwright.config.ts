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
		reuseExistingServer: true,
		timeout: 180_000,
	},

	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	maxFailures: 1,
	timeout: 30_000,
});
