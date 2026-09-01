import { defineConfig } from "drizzle-kit";

// NOTE: drizzle-kit は .env.local を自分では読まない。
// `bunx --bun drizzle-kit ...` (package.json の db:* スクリプト) で実行すること。
// bun ランタイムが .env.local を自動で読み込む。`--bun` を落とすと node の
// shebang で走り、DATABASE_URL が undefined になる。
export default defineConfig({
	dialect: "postgresql",
	schema: "./lib/schema.ts",
	out: "./drizzle",
	dbCredentials: {
		url: process.env.DATABASE_URL as string,
	},
	verbose: true,
	strict: true,
});
