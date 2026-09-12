import { expect, test } from "@playwright/test";

/**
 * オフラインで実際に使えることを確認する。
 *
 * 「端末内 DB を入れた」だけでは足りない。Service Worker が無いと
 * オフラインではページ自体が開けず、ブラウザのエラー画面越しに
 * ローカル DB へは到達できない。両方揃って初めて成立する。
 *
 * context.setOffline(true) は Service Worker の応答を止めないので、
 * 「SW から配られてアプリが起動し、ローカル DB から読み書きできる」
 * という本番同様の経路をそのまま検証できる。
 *
 * 各テストは新しい context を使う。Service Worker の登録が
 * テスト間で残ると、前の実行のキャッシュを見てしまう。
 */

async function register(page: import("@playwright/test").Page) {
	await page.goto("/register");
	await page.getByPlaceholder("ユーザー名").fill(`offline-${Date.now()}`);
	// 端末内 DB (WASM) の起動が終わるまでボタンは無効
	const submit = page.getByRole("button", { name: "登録して始める" });
	await expect(submit).toBeEnabled({ timeout: 30_000 });
	await submit.click();
	// 本が 1 冊も無いと /record はさらに /books-information へ送る (既存の導線)。
	// どちらに着いてもよいので「/register を離れたこと」で判定する。
	await page.waitForURL((url) => !url.pathname.endsWith("/register"));
	await expect(page.getByLabel("ホーム")).toBeVisible();
}

/** Service Worker が実際に配れる状態になるまで待つ */
async function swReady(page: import("@playwright/test").Page) {
	await page.evaluate(async () => {
		const reg = await navigator.serviceWorker.ready;
		// controller が付くまではフェッチが SW を通らない
		if (!navigator.serviceWorker.controller) {
			await new Promise<void>((resolve) => {
				navigator.serviceWorker.addEventListener(
					"controllerchange",
					() => resolve(),
					{ once: true },
				);
				// 既に active なら claim 済みのはず
				if (reg.active && navigator.serviceWorker.controller) resolve();
			});
		}
	});
}

test("オフラインでもアプリが開き、記録できる", async ({ browser }) => {
	const context = await browser.newContext();
	const page = await context.newPage();

	await register(page);
	await swReady(page);

	// 本を登録しておく (まだオンライン)
	await page.goto("/books-information");
	await page.getByPlaceholder("本のタイトルを入力").fill("オフラインの本");
	await page.getByPlaceholder("ページ数を入力").fill("100");
	await page.getByRole("button", { name: "登録", exact: true }).click();
	await page.waitForURL("**/record");

	// ここから先はネットワーク無し
	await context.setOffline(true);

	// リロードしてもアプリが開く (= SW がシェルを配れている)
	await page.reload();
	await expect(page.getByText("進捗を記録")).toBeVisible();

	// 端末内 DB からデータが読めている
	await expect(page.getByRole("combobox")).toHaveText("オフラインの本");

	// オフラインのまま書き込める
	await page.getByPlaceholder("今回読んだページ数を入力").fill("100");
	await page.getByRole("button", { name: "登録", exact: true }).click();
	await expect(page.getByText(/進捗を登録しました/)).toBeVisible();

	// タブ遷移も通る。クライアント遷移は RSC ペイロードを取りに行くので、
	// HTML だけキャッシュしているとここで落ちる。
	await page.getByLabel("ホーム").click();
	const tree = page.getByRole("img", { name: /成長段階/ });
	await expect(tree).toHaveAttribute("alt", "成長段階 3 の木");

	await context.close();
});

test("オフラインのまま新規登録できる", async ({ browser }) => {
	const context = await browser.newContext();
	const page = await context.newPage();

	// 一度オンラインで開いて SW とローカル DB を用意する
	await page.goto("/register");
	await swReady(page);
	await expect(page.getByText("新規登録")).toBeVisible();

	await context.setOffline(true);
	await page.reload();

	await page.getByPlaceholder("ユーザー名").fill("offline-register");
	const submit = page.getByRole("button", { name: "登録して始める" });
	await expect(submit).toBeEnabled({ timeout: 30_000 });
	await submit.click();

	// サーバに一切触れずにセッションが始まる
	await page.waitForURL((url) => !url.pathname.endsWith("/register"));
	await expect(page.getByLabel("ホーム")).toBeVisible();

	await context.close();
});

test("2 タブ目は開けないことを画面で知らせる", async ({ browser }) => {
	const context = await browser.newContext();
	const page = await context.newPage();
	await register(page);

	// PGlite は IndexedDB 上で単一接続前提。2 タブが同時に書くと
	// 例外を出さずに片方の書き込みが消える (実測) ので、開かせない。
	const second = await context.newPage();
	await second.goto("/record");
	await expect(
		second.getByText("このアプリは 1 つのタブでのみ開けます"),
	).toBeVisible();

	await context.close();
});
