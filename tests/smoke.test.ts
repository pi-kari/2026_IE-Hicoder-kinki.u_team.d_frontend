import { expect, test } from "@playwright/test";

/**
 * 旧 tests/export.test.ts の置き換え。
 *
 * 旧テストは expo export の静的出力に対して "Tamagui + Expo" という modal の
 * タイトルが / に出ることを assert していたが、その文字列は / に無く、
 * 未ログインだと / は /register へリダイレクトされるので stale だった。
 *
 * ここでは実際の導線 (未ログイン -> 登録 -> 記録画面) をなぞる。
 */
test("未ログインだと /register に飛ばされ、登録するとタブ画面に入れる", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (err) => errors.push(err.message));

	await page.goto("/");

	// AuthGuard がクライアント側で飛ばす
	await page.waitForURL("**/register");
	await expect(page.getByText("新規登録")).toBeVisible();

	// Tamagui のテーマが効いていること (テキストに色が解決されている)
	const heading = page.getByText("新規登録");
	const color = await heading.evaluate(
		(el) => window.getComputedStyle(el).color,
	);
	expect(color).toBeTruthy();

	// 登録するとセッションが保存され /record へ
	await page.getByPlaceholder("ユーザー名").fill(`e2e-${Date.now()}`);
	await page.getByText("登録して始める").click();

	await page.waitForURL("**/record");
	await expect(page.getByText("進捗を記録")).toBeVisible();

	// タブバーが出ていること
	await expect(page.getByLabel("ホーム")).toBeVisible();
	await expect(page.getByLabel("プロフィール")).toBeVisible();

	expect(errors.filter((e) => e.includes("Missing theme"))).toHaveLength(0);
});
