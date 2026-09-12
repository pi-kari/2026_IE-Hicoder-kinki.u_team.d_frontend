/**
 * UUIDv7 を生成する。
 *
 * なぜ v4 (`crypto.randomUUID()`) ではなく v7 か:
 * 進捗履歴は `orderBy(asc(progress.progressId))` で並べており、これは
 * FastAPI のヒープ順依存を決定的にするために意図的に入れたもの。
 * ランダムな v4 はこの順序を壊す。v7 は先頭 48bit がミリ秒なので
 * 「主キー昇順 = 作成順」がそのまま生き残る。
 *
 * 同期でも効く。outbox を id 昇順に排出すれば因果順が保たれるので、
 * `book.create` が必ずその本の `progress.record` より先にサーバへ届く
 * (サーバ側には実 FK がある)。
 *
 * ブラウザに `crypto.randomUUIDv7()` は無いので自前で組む。依存は増やさない。
 *
 * レイアウト (RFC 9562):
 *   48bit unix_ts_ms | 4bit ver(7) | 12bit rand_a | 2bit var(10) | 62bit rand_b
 */

// 同一ミリ秒内でも単調増加させるための連番。rand_a の 12bit を使う。
// これが無いと、同じミリ秒に記録された 2 行の順序がランダムになり、
// 履歴の表示順が実行のたびに変わる。
let lastMs = -1;
let seq = 0;

export function uuidv7(): string {
	let ms = Date.now();

	if (ms === lastMs) {
		seq += 1;
		// 12bit を使い切ったら次のミリ秒へ進める。時計が戻ったときも同じ扱いで、
		// 単調増加を時刻の正確さより優先する。
		if (seq > 0xfff) {
			ms = lastMs + 1;
			lastMs = ms;
			seq = 0;
		}
	} else if (ms < lastMs) {
		ms = lastMs;
		seq += 1;
	} else {
		lastMs = ms;
		seq = 0;
	}

	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);

	// 48bit タイムスタンプ。ms は 2^48 未満 (西暦 10889 年まで) なので
	// Number の整数精度 (2^53) に収まる。
	bytes[0] = (ms / 2 ** 40) & 0xff;
	bytes[1] = (ms / 2 ** 32) & 0xff;
	bytes[2] = (ms / 2 ** 24) & 0xff;
	bytes[3] = (ms / 2 ** 16) & 0xff;
	bytes[4] = (ms / 2 ** 8) & 0xff;
	bytes[5] = ms & 0xff;

	// version 7 + rand_a を連番で置き換える
	bytes[6] = 0x70 | ((seq >> 8) & 0x0f);
	bytes[7] = seq & 0xff;

	// variant 10xx
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
		"",
	);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** パスパラメータ等の検証用。RFC 9562 の 8-4-4-4-12 形式かどうかだけを見る。 */
const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(raw: string): boolean {
	return UUID_RE.test(raw);
}
