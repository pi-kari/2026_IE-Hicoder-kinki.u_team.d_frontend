import { expect, test } from "@playwright/test";

/**
 * ISBN から書籍情報を引いてフォームに入れる経路。
 *
 * **カメラは使わない。** スキャンも手入力も同じ applyIsbn に合流させてあるので、
 * ISBN 入力欄を通せば読み取り後とまったく同じ処理を検証できる。
 * カメラでの実読み取り (背面カメラの選択、2 段バーコードの上段だけ拾うこと) は
 * 実機でしか確かめられないので、ここでは扱わない。
 *
 * **Service Worker を切った context を使う。** SW に制御されたページからの
 * fetch は page.route() を素通りすることがあり、スタブが当たらない。
 * この画面は SW を必要としないので最初から止めておく。
 * オフライン分岐のテストだけは setOffline が要るので SW ありのままにする。
 */

const ISBN = "9784873115658";

const META = {
	isbn: ISBN,
	title: "リーダブルコード",
	pages: 237,
	publisher: "オライリー・ジャパン",
	author: "Boswell, Dustin",
	cover: null,
};

async function register(page: import("@playwright/test").Page) {
	await page.goto("/register");
	await page.getByPlaceholder("ユーザー名").fill(`isbn-${Date.now()}`);
	// 端末内 DB (WASM) の起動が終わるまでボタンは無効
	const submit = page.getByRole("button", { name: "登録して始める" });
	await expect(submit).toBeEnabled({ timeout: 30_000 });
	await submit.click();
	await page.waitForURL((url) => !url.pathname.endsWith("/register"));
	await expect(page.getByLabel("ホーム")).toBeVisible();
}

test("ISBN から書名とページ数が自動で入り、そのまま登録できる", async ({
	browser,
}) => {
	const context = await browser.newContext({ serviceWorkers: "block" });
	await context.route("**/api/isbn/**", (route) =>
		route.fulfill({ json: META }),
	);
	const page = await context.newPage();

	await register(page);
	await page.goto("/books-information");

	const fetchButton = page.getByRole("button", { name: "取得" });
	await page.getByPlaceholder("ISBN を入力").fill(ISBN);
	await expect(fetchButton).toBeEnabled({ timeout: 30_000 });
	await fetchButton.click();

	// 書名とページ数がフォームに入る
	await expect(page.getByPlaceholder("本のタイトルを入力")).toHaveValue(
		"リーダブルコード",
	);
	await expect(page.getByPlaceholder("ページ数を入力")).toHaveValue("237");

	await page.getByRole("button", { name: "登録", exact: true }).click();
	await page.waitForURL("**/record");

	// 本棚にその書名で入っていること
	await page.goto("/books");
	await expect(page.getByText("リーダブルコード")).toBeVisible({
		timeout: 30_000,
	});

	await context.close();
});

test("ページ数が取れない本は書名だけ入り、手で補える", async ({ browser }) => {
	const context = await browser.newContext({ serviceWorkers: "block" });
	// NDL は版によって dc:extent を持たない。そのとき pages は null で返る。
	await context.route("**/api/isbn/**", (route) =>
		route.fulfill({
			json: { ...META, title: "ページ数不明の本", pages: null },
		}),
	);
	const page = await context.newPage();

	await register(page);
	await page.goto("/books-information");

	const fetchButton = page.getByRole("button", { name: "取得" });
	await page.getByPlaceholder("ISBN を入力").fill(ISBN);
	await expect(fetchButton).toBeEnabled({ timeout: 30_000 });
	await fetchButton.click();

	await expect(page.getByPlaceholder("本のタイトルを入力")).toHaveValue(
		"ページ数不明の本",
	);
	await expect(page.getByPlaceholder("ページ数を入力")).toHaveValue("");
	await expect(page.locator("#isbn-notice")).toContainText("ページ数");

	// 手で補えば登録できる
	await page.getByPlaceholder("ページ数を入力").fill("300");
	await page.getByRole("button", { name: "登録", exact: true }).click();
	await page.waitForURL("**/record");

	await context.close();
});

test("見つからない ISBN でも手入力で登録でき、ISBN は 13 桁に正規化される", async ({
	browser,
}) => {
	const context = await browser.newContext({ serviceWorkers: "block" });
	await context.route("**/api/isbn/**", (route) =>
		route.fulfill({ status: 404, json: { detail: "Book not found" } }),
	);
	const page = await context.newPage();

	await register(page);
	await page.goto("/books-information");

	const fetchButton = page.getByRole("button", { name: "取得" });
	// ISBN-10 のハイフン付きで入れる。ここで生の入力を保存してしまうと
	// 10 桁のまま残り、表紙の突き合わせも後の再取得も一致しなくなる。
	await page.getByPlaceholder("ISBN を入力").fill("4-10-101001-3");
	await expect(fetchButton).toBeEnabled({ timeout: 30_000 });
	await fetchButton.click();

	await expect(page.locator("#isbn-notice")).toContainText("見つかりません");
	// 書誌が引けなくても、控える ISBN は正規化済みであること
	await expect(page.getByPlaceholder("ISBN を入力")).toHaveValue(
		"9784101010014",
	);

	// 案内が出るだけで、手入力の道は塞がれていない
	await page.getByPlaceholder("本のタイトルを入力").fill("手で入れた本");
	await page.getByPlaceholder("ページ数を入力").fill("120");
	await page.getByRole("button", { name: "登録", exact: true }).click();
	await page.waitForURL("**/record");

	await context.close();
});

test("オフラインでは案内を出し、手入力での登録は続けられる", async ({
	browser,
}) => {
	// setOffline を使うので SW は止めない (本番同様、SW 経由でページが開く)。
	const context = await browser.newContext();
	const page = await context.newPage();

	await register(page);
	await page.goto("/books-information");
	// 端末内 DB (WASM) の起動を待つ。「取得」は ISBN 未入力だと無効なので
	// 待機の目印には使えない。「登録」は ready だけで有効になる。
	await expect(
		page.getByRole("button", { name: "登録", exact: true }),
	).toBeEnabled({ timeout: 30_000 });

	await context.setOffline(true);

	await page.getByPlaceholder("ISBN を入力").fill(ISBN);
	await page.getByRole("button", { name: "取得" }).click();

	await expect(page.locator("#isbn-notice")).toContainText("オフライン", {
		timeout: 30_000,
	});

	// オフラインでも登録自体は端末内 DB に入る
	await page.getByPlaceholder("本のタイトルを入力").fill("オフラインで登録");
	await page.getByPlaceholder("ページ数を入力").fill("80");
	await page.getByRole("button", { name: "登録", exact: true }).click();
	await page.waitForURL("**/record");

	await context.close();
});

const ISBN2 = "9784297127473";

test("同じ ISBN の本は二重に登録できない", async ({ browser }) => {
	const context = await browser.newContext({ serviceWorkers: "block" });
	// ISBN ごとに別の書誌を返す
	await context.route("**/api/isbn/**", (route) => {
		const isbn = route.request().url().split("/").pop() ?? "";
		route.fulfill({
			json:
				isbn === ISBN2
					? { ...META, isbn: ISBN2, title: "TypeScript入門", pages: 411 }
					: META,
		});
	});
	const page = await context.newPage();

	await register(page);

	const fetchButton = page.getByRole("button", { name: "取得" });
	const addByIsbn = async (isbn: string, title: string) => {
		await page.goto("/books-information");
		await page.getByPlaceholder("ISBN を入力").fill(isbn);
		await expect(fetchButton).toBeEnabled({ timeout: 30_000 });
		await fetchButton.click();
		await expect(page.getByPlaceholder("本のタイトルを入力")).toHaveValue(
			title,
		);
		await page.getByRole("button", { name: "登録", exact: true }).click();
		await page.waitForURL("**/record");
	};

	// 2 冊登録する。**重複する方を末尾にしない**のが肝心で、
	// 末尾の本を既定で選ぶ挙動だと導線が別の本に着いてしまう。
	await addByIsbn(ISBN, "リーダブルコード");
	await addByIsbn(ISBN2, "TypeScript入門");

	// 1 冊目と同じ ISBN をもう一度読み取る
	await page.goto("/books-information");
	await page.getByPlaceholder("ISBN を入力").fill(ISBN);
	await expect(fetchButton).toBeEnabled({ timeout: 30_000 });
	await fetchButton.click();

	// 登録ボタンを押す前に気づかせる
	await expect(page.locator("#duplicate-notice")).toContainText(
		"「リーダブルコード」は登録済みです",
	);
	await expect(
		page.getByRole("button", { name: "登録", exact: true }),
	).toBeDisabled();

	// 行き止まりにせず、記録画面への導線を出す。
	// **その本が選ばれていること**まで見る。末尾の本を選ぶ既定のままだと
	// 別の本の画面に着いてしまう。
	await page.getByRole("button", { name: "この本の進捗を記録する" }).click();
	await page.waitForURL("**/record");
	await expect(page.getByRole("combobox")).toHaveText("リーダブルコード", {
		timeout: 30_000,
	});

	// 本棚は 1 冊のまま
	await page.goto("/books");
	await expect(page.getByText("リーダブルコード")).toHaveCount(1, {
		timeout: 30_000,
	});

	await context.close();
});
