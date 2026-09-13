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
	// 端末内 DB (WASM) の起動が終わるまでボタンは無効
	const submit = page.getByRole("button", { name: "登録して始める" });
	await expect(submit).toBeEnabled({ timeout: 30_000 });
	await submit.click();

	// 本が 1 冊も無いと /record はさらに /books-information へ送る
	await page.waitForURL((url) => !url.pathname.endsWith("/register"));
	// タブバーが出ていること
	await expect(page.getByLabel("ホーム")).toBeVisible();
	await expect(page.getByLabel("プロフィール")).toBeVisible();

	expect(errors.filter((e) => e.includes("Missing theme"))).toHaveLength(0);
});

/**
 * 木が最終段階 (tree_state 3 / tree_3.png) まで育つことを確認する。
 *
 * これは今まで一度も到達できなかった状態だった。`tree_ratio` の計算に
 * ゼロ除算ガードの `book_pages + 1e-8` が入っていたため、読了しても 99 にしかならず
 * `tree_3.png` は死んだアセットだった。ガードを外したので初めて表示される。
 *
 * 画面の見た目そのものが「本を読むと木が育つ」というこのアプリの中心なので、
 * API のレスポンスではなく実際に描画された画像で確認する。
 */
test("本を読了すると木が最終段階の画像になる", async ({ page }) => {
	await page.goto("/register");
	await page.getByPlaceholder("ユーザー名").fill(`tree-${Date.now()}`);
	const submit = page.getByRole("button", { name: "登録して始める" });
	await expect(submit).toBeEnabled({ timeout: 30_000 });
	await submit.click();
	await page.waitForURL((url) => !url.pathname.endsWith("/register"));

	// 本を 1 冊登録する (100 ページ)
	await page.goto("/books-information");
	await page.getByPlaceholder("本のタイトルを入力").fill("読了する本");
	await page.getByPlaceholder("ページ数を入力").fill("100");
	const addBook = page.getByRole("button", { name: "登録", exact: true });
	await expect(addBook).toBeEnabled({ timeout: 30_000 });
	await addBook.click();
	// 登録できると /record へ送られる
	await page.waitForURL("**/record");

	// 100 ページ読んだことにする。
	// 本は 1 冊なので、一覧を取った時点で自動で選択されている
	// (book_id が uuidv7 = 時刻順なので「末尾 = 最後に登録した本」)。
	await expect(page.getByRole("combobox")).toHaveText("読了する本");
	await page.getByPlaceholder("読み終わったページを入力").fill("100");
	await page.getByRole("button", { name: "登録", exact: true }).click();
	await expect(page.getByText(/進捗を登録しました/)).toBeVisible();

	// ホームの木が最終段階になる
	await page.goto("/");
	const tree = page.getByRole("img", { name: /成長段階/ });
	await expect(tree).toBeVisible();
	await expect(tree).toHaveAttribute("alt", "成長段階 3 の木");
	// next/image 経由なので幅は要求値に依存する。実際に画素が来ていることだけ見る。
	// 属性が付いた直後はまだデコードが終わっていないので poll する。
	await expect
		.poll(() => tree.evaluate((el: HTMLImageElement) => el.naturalWidth))
		.toBeGreaterThan(0);
});

/**
 * 進捗バーは「総ページ数に対する割合」を出す。
 *
 * total_progress は到達ページ番号なので、これをそのまま max={100} の
 * Progress に渡すと 100 ページを超える本が軒並み満タンに見えてしまう。
 * ここでは 300 ページ中 104 ページ = 34% を実際の表示で確かめる。
 */
test("進捗バーはページ数に対する割合を出す", async ({ page }) => {
	await page.goto("/register");
	await page.getByPlaceholder("ユーザー名").fill(`ratio-${Date.now()}`);
	const submit = page.getByRole("button", { name: "登録して始める" });
	await expect(submit).toBeEnabled({ timeout: 30_000 });
	await submit.click();
	await page.waitForURL((url) => !url.pathname.endsWith("/register"));

	await page.goto("/books-information");
	await page.getByPlaceholder("本のタイトルを入力").fill("長い本");
	await page.getByPlaceholder("ページ数を入力").fill("300");
	const addBook = page.getByRole("button", { name: "登録", exact: true });
	await expect(addBook).toBeEnabled({ timeout: 30_000 });
	await addBook.click();
	await page.waitForURL("**/record");

	// 104 ページまで読んだ (読んだページ数ではなく到達ページ番号)
	await expect(page.getByRole("combobox")).toHaveText("長い本");
	await page.getByPlaceholder("読み終わったページを入力").fill("104");
	await page.getByRole("button", { name: "登録", exact: true }).click();
	await expect(page.getByText(/進捗を登録しました/)).toBeVisible();

	await page.goto("/");
	// 104 / 300 = 34%。以前は 104 をそのまま百分率として渡していたので 100% だった。
	await expect(page.getByText("104 / 300 ページ (34%)")).toBeVisible({
		timeout: 30_000,
	});
	const bar = page.getByRole("progressbar").first();
	await expect(bar).toHaveAttribute("aria-valuenow", "34");
	// 木もまだ 1 段階目 (50% 未満)
	await expect(page.getByRole("img", { name: /成長段階/ })).toHaveAttribute(
		"alt",
		"成長段階 1 の木",
	);
});
