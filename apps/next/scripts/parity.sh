#!/usr/bin/env bash
#
# FastAPI (旧) と Next.js (新) に同一のリクエスト列を投げ、ステータスと JSON を比較する。
#
#   OLD=http://localhost:8000 NEW=http://localhost:3000/api ./scripts/parity.sh
#
# 前提: 2 つのスタックを「別々の DB」に向けて、どちらも空の状態から起動すること。
#   docker compose up -d db
#   docker compose exec db psql -U postgres -c 'CREATE DATABASE parity_fastapi'
#   docker compose exec db psql -U postgres -c 'CREATE DATABASE parity_next'
# 同一 DB を共有すると username の unique 衝突と serial のズレで差分がノイズになる。
#
# 合否基準: 差分ゼロ。バグ修正は Phase 3 に送ったので「意図した差分」は存在しない。
# 差分が出たら理由を問わずリグレッション。
#
# 例外は 2 つだけ:
#   - 422 はステータス + detail[].loc のみ比較する。Pydantic は input/url を持ち、
#     msg 文言も zod とは一致しないためバイト一致は原理的に不可能。
#   - history[].date は実時刻なので比較前に落とす。
set -uo pipefail

OLD="${OLD:-http://localhost:8000}"
NEW="${NEW:-http://localhost:3000/api}"
OUT="$(mktemp -d)"
TODAY_JST="$(TZ=Asia/Tokyo date +%F)"
FAIL=0

# 422 のケース: detail[] から msg/type/input/url を落として loc だけ残す
NORMALIZE_LOC='if type=="object" and (.detail|type)=="array"
               then .detail |= map({loc}) else . end'
# history[].date は実時刻なので落とす
NORMALIZE_DATE='if type=="object" and has("history")
                then .history |= map(del(.date)) else . end'

req() { # req <label> <METHOD> <path> [json-body]
	local label="$1" method="$2" path="$3" body="${4:-}"
	local side base args
	for side in old new; do
		if [ "$side" = old ]; then base="$OLD"; else base="$NEW"; fi
		args=(-sS -X "$method" -o "$OUT/$label.$side.body" -w '%{http_code}')
		if [ -n "$body" ]; then
			args+=(-H 'Content-Type: application/json' -d "$body")
		fi
		curl "${args[@]}" "$base$path" > "$OUT/$label.$side.code" 2>/dev/null

		# JSON なら正規化、そうでなければ (500 の plain text 等) 生のまま比較する
		if jq -e . "$OUT/$label.$side.body" >/dev/null 2>&1; then
			jq -S "$NORMALIZE_DATE | $NORMALIZE_LOC" \
				"$OUT/$label.$side.body" > "$OUT/$label.$side.json"
		else
			cp "$OUT/$label.$side.body" "$OUT/$label.$side.json"
		fi
	done

	local oldcode newcode
	oldcode="$(cat "$OUT/$label.old.code")"
	newcode="$(cat "$OUT/$label.new.code")"
	if [ "$oldcode" = "$newcode" ] \
		&& diff -q "$OUT/$label.old.json" "$OUT/$label.new.json" >/dev/null; then
		printf '  OK    %-22s [%s]\n' "$label" "$oldcode"
	else
		printf '  FAIL  %-22s old=%s new=%s\n' "$label" "$oldcode" "$newcode"
		diff -u "$OUT/$label.old.json" "$OUT/$label.new.json" | sed 's/^/          /'
		FAIL=1
	fi
}

echo "OLD=$OLD"
echo "NEW=$NEW"
echo

echo "== health / users =="
req health           GET  /health
# user_mail_address を必ず送る: fresh DB の FastAPI は create_all が
# user_mail_address を NOT NULL で作るため、省くと 500 になる（移植の正誤とは無関係な環境差）
req create-user      PUT  /users '{"username":"parity_taro","user_mail_address":"taro@example.com"}'
USER_ID="$(jq -r .user_id "$OUT/create-user.old.json")"
# NOTE: 変数名に UID は使えない (bash の読み取り専用変数)。黙って OS の uid が入り、
# 以降が全部「存在しないユーザ」への 404 になって偽の OK が並ぶ。
require_id() { # require_id <name> <value>
	case "$2" in
		''|null|*[!0-9]*)
			echo "FATAL: $1 を取得できませんでした (値='$2')。両スタックが起動して" >&2
			echo "       空の DB を向いているか確認してください。artifacts: $OUT" >&2
			exit 2
			;;
	esac
}
require_id USER_ID "$USER_ID"
req get-user         GET  "/users/$USER_ID"
req get-user-404     GET  /users/999999
req patch-user       PATCH "/users/$USER_ID" '{"username":"parity_taro_2"}'
# 既知バグ #1: 存在しないユーザへの PATCH は両方 500 (plain text)
req patch-missing    PATCH /users/999999 '{"username":"x"}'
# username 重複 → unique 違反 → 両方 500
req dup-username     PUT  /users '{"username":"parity_taro_2","user_mail_address":"dup@example.com"}'

echo
echo "== books =="
# status:"string" は books-information.tsx が実際に送っている値。
# 既知バグ #3 により無視され、DB 既定値 "積読" が入るはず。
req create-book-a    PUT  "/users/$USER_ID/books" '{"book_title":"本A","status":"string","book_pages":120}'
req create-book-b    PUT  "/users/$USER_ID/books" '{"book_title":"本B","status":"string","book_pages":0}'
BA="$(jq -r .book_id "$OUT/create-book-a.old.json")"
BB="$(jq -r .book_id "$OUT/create-book-b.old.json")"
require_id BA "$BA"
require_id BB "$BB"
req create-book-404  PUT  /users/999999/books '{"book_title":"x","status":"s","book_pages":1}'
req list-books       GET  "/users/$USER_ID/books"
req list-books-empty GET  /users/999999/books
req get-book         GET  "/users/$USER_ID/books/$BA"
req get-book-404     GET  "/users/$USER_ID/books/999999"
req update-book      POST "/users/$USER_ID/books/$BA" '{"book_title":"本A改","status":"読了","book_pages":120}'
req user-after-books GET  "/users/$USER_ID"

echo
echo "== progress (tree_state 1 -> 2 -> 3) =="
req prog-1           POST "/users/$USER_ID/books/$BA/progress" '{"pages_read":30}'
req prog-boundary    POST "/users/$USER_ID/books/$BA/progress" '{"pages_read":30}'
req prog-over        POST "/users/$USER_ID/books/$BA/progress" '{"pages_read":100}'
req tree             GET  "/users/$USER_ID/books/$BA/tree"
req tree-404         GET  "/users/$USER_ID/books/999999/tree"
req history          GET  "/users/$USER_ID/books/$BA/progress"
# 既知バグ #2: limit/offset は Book クエリに効くので offset>=1 は 404 になる
req history-paged    GET  "/users/$USER_ID/books/$BA/progress?limit=5&offset=0"
req history-offset1  GET  "/users/$USER_ID/books/$BA/progress?limit=5&offset=1"
req history-limit0   GET  "/users/$USER_ID/books/$BA/progress?limit=0&offset=0"
req today            GET  "/users/$USER_ID/books/$BA/progress/today"
req today-404        GET  "/users/$USER_ID/books/999999/progress/today"
req by-date          GET  "/users/$USER_ID/books/$BA/progress/date/$TODAY_JST"
req by-date-empty    GET  "/users/$USER_ID/books/$BA/progress/date/2000-01-01"
req prog-404         POST "/users/$USER_ID/books/999999/progress" '{"pages_read":1}'
# 既知バグ #4: book_pages = 0 は int4 オーバーフローで両方 500
req zero-page-prog   POST "/users/$USER_ID/books/$BB/progress" '{"pages_read":1}'

echo
echo "== validation (422: status + detail[].loc のみ比較) =="
req bad-int-param    GET  /users/abc/books
req bad-book-param   GET  "/users/$USER_ID/books/abc"
req bad-date         GET  "/users/$USER_ID/books/$BA/progress/date/2026-02-30"
req bad-body         PUT  "/users/$USER_ID/books" '{"book_title":"x","status":"s","book_pages":null}'

echo
if [ "$FAIL" -eq 0 ]; then
	echo "PARITY OK   (artifacts: $OUT)"
else
	echo "PARITY FAILED   (artifacts: $OUT)"
fi
exit "$FAIL"
