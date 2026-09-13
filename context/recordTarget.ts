// 「次に /record を開いたときに選ぶ本」の受け渡し。
//
// クエリパラメータ (/record?bookId=…) ではなく sessionStorage を使う。
// /record は静的にプリレンダされるページで、クエリを読むと useSearchParams の
// Suspense 境界が要る。ここで渡したいのは一度きりの遷移意図であって
// 共有できる URL ではないので、ページの描画方式に縛られない方を選ぶ。
//
// タブを閉じたら消えてよいので sessionStorage。読んだ側が必ず消す。
// context/sessionStorage.ts と同じく typeof window のガードを置く
// (Next は SSR / RSC でこのモジュールを評価しうる)。

const KEY = "record_target_book_id";

export function setRecordTarget(bookId: string): void {
	if (typeof window === "undefined") return;
	try {
		window.sessionStorage.setItem(KEY, bookId);
	} catch {
		// プライベートウィンドウ等で弾かれても、既定の本が選ばれるだけ。
	}
}

/** 一度だけ取り出す。取り出したら消す。 */
export function takeRecordTarget(): string | null {
	if (typeof window === "undefined") return null;
	try {
		const found = window.sessionStorage.getItem(KEY);
		if (found) window.sessionStorage.removeItem(KEY);
		return found;
	} catch {
		return null;
	}
}
