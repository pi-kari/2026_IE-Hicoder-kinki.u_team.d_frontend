import { expect, test } from "@playwright/test";

/**
 * 認証。
 *
 * このアプリにログイン画面は無い。登録時に端末が 256bit の秘密を作り、
 * 初回同期でそれを提示して user_id を確保する。以後は httpOnly cookie の
 * セッションで認証する。**user_id は資格情報ではない。**
 *
 * ここで見るのは「他人のデータに手が届かないこと」。
 */

type Page = import("@playwright/test").Page;

async function registerAndSync(page: Page, name: string) {
	await page.goto("/register");
	await page.getByPlaceholder("ユーザー名").fill(name);
	const submit = page.getByRole("button", { name: "登録して始める" });
	await expect(submit).toBeEnabled({ timeout: 30_000 });
	await submit.click();
	await page.waitForURL((url) => !url.pathname.endsWith("/register"));
	// 初回同期でアカウントが確保される
	await expect(page.locator("#sync-status")).toHaveAttribute(
		"data-pending",
		"0",
		{ timeout: 60_000 },
	);
}

test("未認証では同期 API を叩けない", async ({ browser }) => {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto("/register");

	// cookie を持たない状態
	const pull = await page.request.get("/api/sync/pull");
	expect(pull.status()).toBe(401);

	const push = await page.request.post("/api/sync/push", {
		data: { ops: [] },
	});
	expect(push.status()).toBe(401);

	await context.close();
});

test("user_id を知っていても他人のデータには手が届かない", async ({
	browser,
}) => {
	test.setTimeout(180_000);

	// 被害者側を作る
	const victimCtx = await browser.newContext();
	const victim = await victimCtx.newPage();
	await registerAndSync(victim, `victim-${Date.now()}`);
	const victimId = await victim.evaluate(() =>
		localStorage.getItem("user_session"),
	);
	expect(victimId).toBeTruthy();

	// 攻撃側は別の端末。自分のアカウントは持っている。
	const attackerCtx = await browser.newContext();
	const attacker = await attackerCtx.newPage();
	await registerAndSync(attacker, `attacker-${Date.now()}`);

	// pull は user_id を受け取らないので、そもそも他人を指定できない。
	// クエリを付けても自分のぶんしか返らない。
	const pull = await attacker.request.get(`/api/sync/pull?user_id=${victimId}`);
	expect(pull.ok()).toBe(true);
	const data = await pull.json();
	expect(data.users.map((u: { user_id: string }) => u.user_id)).not.toContain(
		victimId,
	);

	// 他人の user_id を指す op は rejected になる
	const push = await attacker.request.post("/api/sync/push", {
		data: {
			ops: [
				{
					id: "01a09700-0000-7000-8000-00000000aaaa",
					op: "book.create",
					payload: {
						book_id: "01a09700-0000-7000-8000-00000000bbbb",
						user_id: victimId,
						book_title: "侵入した本",
						status: "積読",
						book_pages: 1,
						updated_at: new Date().toISOString(),
					},
				},
			],
		},
	});
	expect(push.ok()).toBe(true);
	const result = await push.json();
	expect(result.results[0].status).toBe("rejected");

	// 対話 API も同じ。他人の user_id を指すと 403。
	const books = await attacker.request.get(`/api/users/${victimId}/books`);
	expect(books.status()).toBe(403);

	const patch = await attacker.request.patch(`/api/users/${victimId}`, {
		data: { username: "のっとり" },
	});
	expect(patch.status()).toBe(403);

	// 被害者側が実際に無傷であることも確かめる
	const intact = await victim.request.get("/api/sync/pull");
	const victimData = await intact.json();
	expect(victimData.books).toHaveLength(0);

	await victimCtx.close();
	await attackerCtx.close();
});

test("引き継ぎコードは 1 回しか使えない", async ({ browser }) => {
	test.setTimeout(180_000);

	const ownerCtx = await browser.newContext();
	const owner = await ownerCtx.newPage();
	await registerAndSync(owner, `owner-${Date.now()}`);

	await owner.goto("/profile");
	await owner.getByRole("button", { name: "引き継ぎコードを発行" }).click();
	const code = (await owner.locator("#transfer-code").textContent())?.trim();
	expect(code).toBeTruthy();

	const firstCtx = await browser.newContext();
	const first = await firstCtx.newPage();
	await first.goto("/register");
	const ok = await first.request.post("/api/auth/redeem", {
		data: { code },
	});
	expect(ok.ok()).toBe(true);

	// 2 回目は弾かれる
	const secondCtx = await browser.newContext();
	const second = await secondCtx.newPage();
	await second.goto("/register");
	const again = await second.request.post("/api/auth/redeem", {
		data: { code },
	});
	expect(again.status()).toBe(400);

	await ownerCtx.close();
	await firstCtx.close();
	await secondCtx.close();
});
