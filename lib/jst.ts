/** Asia/Tokyo は DST を持たない固定 UTC+9 なので、単純な加算で厳密に計算できる。 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Asia/Tokyo における「今日」を "YYYY-MM-DD" で返す。
 *  crud.get_book_progress_today の datetime.now(ZoneInfo("Asia/Tokyo")).date() 相当。 */
export function todayInJst(): string {
	return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** JST の 1 日を表す半開区間 [start, end)。
 *  created_at は timestamptz なので、絶対時刻の Date で比較すれば
 *  Node / Postgres どちらのタイムゾーン設定にも依存しない。 */
export function jstDayRange(day: string): { start: Date; end: Date } {
	const start = new Date(`${day}T00:00:00+09:00`);
	return { start, end: new Date(start.getTime() + 86_400_000) };
}

/** 厳密な YYYY-MM-DD。Pydantic の date 型と同じく 2026-02-30 や 2026-13-01 を弾く。
 *  V8 は範囲外の ISO 日付に Invalid Date を返すが、繰り上げる実装に備えて
 *  往復比較でも確認している。 */
export function parseIsoDate(raw: string): string | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
	const parsed = new Date(`${raw}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed.toISOString().slice(0, 10) === raw ? raw : null;
}
