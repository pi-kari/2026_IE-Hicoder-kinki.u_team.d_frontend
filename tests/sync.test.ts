import { expect, test } from "@playwright/test";

/**
 * サーバ同期。
 *
 * 端末内 DB が作業用の正で、サーバは同期先兼バックアップ。
 * オフラインで動くことは tests/offline.test.ts で見ているので、
 * ここで見るのは「別々の端末の記録が合流するか」。
 *
 * 2 つの browser context を 2 台の端末に見立てる。context ごとに
 * IndexedDB も localStorage も独立するので、同じ PGlite を共有しない。
 */

type Page = import("@playwright/test").Page;

async function register(page: Page, name: string): Promise<string> {
	await page.goto("/register");
	await page.getByPlaceholder("ユーザー名").fill(name);
	const submit = page.getByRole("button", { name: "登録して始める" });
	await expect(submit).toBeEnabled({ timeout: 30_000 });
	await submit.click();
	await page.waitForURL((url) => !url.pathname.endsWith("/register"));

	// 2 台目で使うためにユーザー ID を取る。
	// セッションの復元は非同期なので、埋まるまで待つ。
	await page.goto("/profile");
	const idText = page.locator("#user-id");
	await expect(idText).not.toHaveText("—", { timeout: 30_000 });
	const id = (await idText.textContent())?.trim();
	if (!id) throw new Error("ユーザー ID を取得できませんでした");
	return id;
}

async function addBook(page: Page, title: string, pages: string) {
	await page.goto("/books-information");
	await page.getByPlaceholder("本のタイトルを入力").fill(title);
	await page.getByPlaceholder("ページ数を入力").fill(pages);
	const add = page.getByRole("button", { name: "登録", exact: true });
	await expect(add).toBeEnabled({ timeout: 30_000 });
	await add.click();
	await page.waitForURL("**/record");
}

async function record(page: Page, pages: string) {
	await page.goto("/record");
	// 本が選ばれていないと「本を選択してください」で弾かれる
	await expect(page.getByRole("combobox")).not.toHaveText("書籍を選択", {
		timeout: 30_000,
	});
	const input = page.getByPlaceholder("今回読んだページ数を入力");
	await input.fill(pages);
	await page.getByRole("button", { name: "登録", exact: true }).click();
	// トーストは消えるので、成功時に入力が空になることで判定する
	await expect(input).toHaveValue("", { timeout: 30_000 });
}

/** 未送信が捌けるまで待つ。
 *  表示文言ではなく未送信件数そのものを見る (文言は状態遷移の途中でも
 *  「同期済み」になりうるため)。 */
async function synced(page: Page) {
	const status = page.locator("#sync-status");
	await expect(status).toHaveAttribute("data-pending", "0", {
		timeout: 60_000,
	});
	await expect(status).toHaveAttribute("data-failed", "0");
}

test("オフラインで記録したものがオンライン復帰後にサーバへ送られる", async ({
	browser,
}) => {
	const context = await browser.newContext();
	const page = await context.newPage();

	const userId = await register(page, `sync-${Date.now()}`);
	await addBook(page, "同期する本", "100");
	await synced(page);

	// オフラインで記録する
	await context.setOffline(true);
	await record(page, "60");
	await expect(page.locator("#sync-status")).toHaveText(/未同期/);

	// 復帰すると送られる
	await context.setOffline(false);
	await synced(page);

	// サーバ側に実在することを Node から直接確かめる
	const res = await page.request.get(
		`/api/sync/pull?user_id=${encodeURIComponent(userId)}`,
	);
	expect(res.ok()).toBe(true);
	const data = await res.json();
	expect(data.books).toHaveLength(1);
	expect(data.progress.map((p: { progress: number }) => p.progress)).toEqual([
		60,
	]);

	await context.close();
});

test("2 台の端末で別々にオフライン記録すると、両方に両方の記録が入る", async ({
	browser,
}) => {
	// 端末 2 台ぶんの DB 起動 (WASM) と同期の往復があるので既定の 30 秒では足りない
	test.setTimeout(180_000);

	const first = await browser.newContext();
	const pageA = await first.newPage();

	const userId = await register(pageA, `two-${Date.now()}`);
	await addBook(pageA, "共有する本", "100");
	await synced(pageA);

	// 2 台目はユーザー ID を入れて合流する (このアプリにログインは無い)
	const second = await browser.newContext();
	const pageB = await second.newPage();
	await pageB.goto("/register");
	await pageB.getByPlaceholder("既存のユーザー ID").fill(userId);
	const join = pageB.getByRole("button", {
		name: "既存のユーザー ID で続ける",
	});
	await expect(join).toBeEnabled({ timeout: 30_000 });
	await join.click();

	// 2 台目のローカル DB にはまだ何も無いので、まず pull で埋まる必要がある。
	// 合流できたら本が見えるはず。
	await pageB.waitForURL((url) => !url.pathname.endsWith("/register"), {
		timeout: 30_000,
	});
	await pageB.goto("/record");
	await expect(pageB.getByRole("combobox")).toHaveText("共有する本", {
		timeout: 30_000,
	});

	// 両方オフラインにして別々に記録する
	await first.setOffline(true);
	await second.setOffline(true);
	await record(pageA, "30");
	await record(pageB, "70");

	// 両方オンラインに戻す。まず双方が送りきる。
	await first.setOffline(false);
	await second.setOffline(false);
	await synced(pageA);
	await synced(pageB);

	// 送信と取得は 1 回の同期で「送る → 取る」の順に走るので、
	// 相手の分を取り込むにはもう一巡要る。実アプリでは 30 秒間隔の
	// 定期同期が回すが、テストではリロードで即座に走らせる。
	for (const page of [pageA, pageB]) {
		await page.reload();
		await synced(page);
	}

	// どちらの端末から見ても合算されて読了になっている
	for (const page of [pageA, pageB]) {
		await page.goto("/");
		const tree = page.getByRole("img", { name: /成長段階/ });
		await expect(tree).toHaveAttribute("alt", "成長段階 3 の木", {
			timeout: 60_000,
		});
	}

	await first.close();
	await second.close();
});
