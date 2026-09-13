#!/usr/bin/env bash
#
# Route Handler (app/api/**) の HTTP 層の仕様を 1 台のサーバに対して検証する。
#
#   BASE=http://localhost:3000/api ./scripts/api-spec.sh
#
# 前提: 空の DB を向いていること。
#   docker exec next-db-1 psql -U postgres -d <db> \
#     -c 'TRUNCATE progress, books_list, users CASCADE;'
#
# 経緯: これはもともと FastAPI (旧) と Next.js (新) に同じリクエスト列を投げて
# バイト一致を見る差分ツール (scripts/parity.sh) だった。移植が終わって FastAPI が
# 退役し、主キーが UUID になって契約も変わったので、差分方式は成立しなくなった。
# 35 ケースという資産は残したいので、期待値を直接書く仕様テストに作り替えた。
#
# ユニットテスト (lib/domain/domain.test.ts) との役割分担:
#   こちらは HTTP 層だけ — ステータスコード、404 / 422 のボディ形、シリアライズ。
#   業務ロジックの分岐はユニットテスト側で網羅している。
set -uo pipefail

BASE="${BASE:-http://localhost:3000/api}"
OUT="$(mktemp -d)"
# セッション cookie を持ち回す。/api/users/:uid/** は認証が要る。
JAR="$OUT/cookies.txt"
TODAY_JST="$(TZ=Asia/Tokyo date +%F)"
FAIL=0

# UUID は curl で作れないので uuidgen に頼る (バージョンは問わない)。
uuid() { uuidgen | tr 'A-Z' 'a-z'; }

# req <label> <METHOD> <path> <expected-status> [json-body]
# 直近のレスポンスは $OUT/last.json に残るので、後続の expect_* で中身を見る。
req() {
	local label="$1" method="$2" path="$3" want="$4" body="${5:-}"
	local args=(-sS -X "$method" -o "$OUT/last.body" -w '%{http_code}' -b "$JAR" -c "$JAR")
	[ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")

	local code
	code="$(curl "${args[@]}" "$BASE$path" 2>/dev/null)"
	if jq -e . "$OUT/last.body" >/dev/null 2>&1; then
		jq -S . "$OUT/last.body" > "$OUT/last.json"
	else
		cp "$OUT/last.body" "$OUT/last.json"
	fi
	cp "$OUT/last.json" "$OUT/$label.json"

	if [ "$code" = "$want" ]; then
		printf '  OK    %-22s [%s]\n' "$label" "$code"
	else
		printf '  FAIL  %-22s want=%s got=%s\n' "$label" "$want" "$code"
		sed 's/^/          /' "$OUT/last.json" | head -5
		FAIL=1
	fi
}

# expect <label> <jq-filter> <expected>  — 直近のレスポンスの中身を見る
expect() {
	local label="$1" filter="$2" want="$3" got
	got="$(jq -c "$filter" "$OUT/last.json" 2>/dev/null)"
	if [ "$got" = "$want" ]; then
		printf '        %-22s %s == %s\n' "$label" "$filter" "$want"
	else
		printf '  FAIL  %-22s %s: want=%s got=%s\n' "$label" "$filter" "$want" "$got"
		FAIL=1
	fi
}

echo "BASE=$BASE"
echo

echo "== 認証 (未ログインでは触れない) =="
req unauth-books     GET  "/users/$(uuid)/books" 401
# ISBN 照会は外部 (国会図書館) を叩くので、誰でも使えるプロキシにしない
req unauth-isbn      GET  /isbn/9784873115658 401
req unauth-pull      GET  /sync/pull 401
req unauth-push      POST /sync/push 401 '{"ops":[]}'
echo

echo "== health / users =="
req health           GET  /health 200

USER_ID="$(uuid)"
# user_mail_address には unique 索引がある。固定アドレスにすると
# **同じ DB に 2 回流した時点で 500 になり、以降が全部巻き添えで落ちる**。
# 実行ごとに変えて、何度でも流せるようにしておく。
RUN="$(date +%s)-$$"
req create-user      PUT  /users 200 \
	"{\"user_id\":\"$USER_ID\",\"username\":\"spec_taro\",\"user_mail_address\":\"taro-$RUN@example.com\"}"
expect create-user '.user_id' "\"$USER_ID\""
expect create-user '.number_of_books' '0'

# ここから先は認証が要る。端末がやるのと同じく秘密を提示して確保する。
# user_id は資格情報ではないので、これを知っているだけでは何もできない。
SECRET="$(head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=')"
req claim            POST /auth/claim 200 \
	"{\"user_id\":\"$USER_ID\",\"secret\":\"$SECRET\"}"

req get-user         GET  "/users/$USER_ID" 200
# 他人の user_id は 404 ではなく 403 (存在の有無すら漏らさない)
req get-user-other   GET  "/users/$(uuid)" 403

req patch-user       PATCH "/users/$USER_ID" 200 '{"username":"spec_taro_2"}'
expect patch-user '.username' '"spec_taro_2"'

# 他人への PATCH は 403
req patch-other      PATCH "/users/$(uuid)" 403 '{"username":"x"}'

# username の unique 索引を落としたので、同名でも作れる (以前は 500)
req dup-username     PUT  /users 200 \
	"{\"user_id\":\"$(uuid)\",\"username\":\"spec_taro_2\",\"user_mail_address\":\"dup-$RUN@example.com\"}"

echo
echo "== books =="
BA="$(uuid)"
BB="$(uuid)"
req create-book-a    PUT  "/users/$USER_ID/books" 200 \
	"{\"book_id\":\"$BA\",\"book_title\":\"本A\",\"status\":\"読書中\",\"book_pages\":120,\"isbn\":\"9784873115658\"}"
expect create-book-a '.book_id' "\"$BA\""
# バーコード登録で入る ISBN。UI が表紙を引くのに使うので応答にも載る
expect create-book-a '.isbn' '"9784873115658"' 
# 既知バグ #3 修正済み: 以前は status が捨てられて常に "積読" だった
expect create-book-a '.status' '"読書中"'
expect create-book-a '[.total_progress,.tree_ratio,.tree_state]' '[0,0,1]'

req create-book-b    PUT  "/users/$USER_ID/books" 200 \
	"{\"book_id\":\"$BB\",\"book_title\":\"本B\",\"status\":\"積読\",\"book_pages\":0}"
# 手入力で登録した本には ISBN が無い
expect create-book-b '.isbn' 'null' 

req create-book-403  PUT  "/users/$(uuid)/books" 403 \
	"{\"book_id\":\"$(uuid)\",\"book_title\":\"x\",\"status\":\"積読\",\"book_pages\":1}"
req list-books       GET  "/users/$USER_ID/books" 200
expect list-books 'length' '2'
req list-books-other GET  "/users/$(uuid)/books" 403
req get-book         GET  "/users/$USER_ID/books/$BA" 200
req get-book-404     GET  "/users/$USER_ID/books/$(uuid)" 404
expect get-book-404 '.detail' '"Book not found"'
req update-book      POST "/users/$USER_ID/books/$BA" 200 \
	'{"book_title":"本A改","status":"読了","book_pages":120}'
expect update-book '[.book_title,.status]' '["本A改","読了"]'
req user-after-books GET  "/users/$USER_ID" 200
expect user-after-books '.number_of_books' '2'

echo
echo "== progress (tree_state 1 -> 2 -> 3) =="
# page_reached は「そのとき読み終わったページ番号」。到達位置は MAX で導出する
# ので、加算ではなく上書きの意味になる。
#
# 既知バグ #1 修正済み: 1e-8 ガードを外したので 60/120 は 50 (以前は 49)、
# 120/120 は 100 で tree_state 3 に到達する (以前は 99 / state 2 で到達不能)。
req prog-1           POST "/users/$USER_ID/books/$BA/progress" 200 '{"page_reached":30}'
expect prog-1 '[.total_progress,.tree_ratio,.tree_state]' '[30,25,1]'
req prog-boundary    POST "/users/$USER_ID/books/$BA/progress" 200 '{"page_reached":60}'
expect prog-boundary '[.total_progress,.tree_ratio,.tree_state]' '[60,50,2]'
# 読み返して小さい番号を入れても到達位置は下がらない
req prog-back        POST "/users/$USER_ID/books/$BA/progress" 200 '{"page_reached":10}'
expect prog-back '[.total_progress,.tree_ratio,.tree_state]' '[60,50,2]'
req prog-over        POST "/users/$USER_ID/books/$BA/progress" 200 '{"page_reached":160}'
expect prog-over '[.total_progress,.tree_ratio,.tree_state]' '[160,100,3]'

req tree             GET  "/users/$USER_ID/books/$BA/tree" 200
expect tree '[.tree_ratio,.tree_state]' '[100,3]'
req tree-404         GET  "/users/$USER_ID/books/$(uuid)/tree" 404

req history          GET  "/users/$USER_ID/books/$BA/progress" 200
expect history '.total_progress' '160'
# 履歴は記録した到達位置そのまま。total_progress はその最大値 (合計ではない)。
expect history '[.history[].progress]' '[30,60,10,160]'
# 既知バグ #2 修正済み: limit / offset が progress 行に効く。
# 以前は offset>=1 が 404 で、limit は一切効いていなかった。
req history-paged    GET  "/users/$USER_ID/books/$BA/progress?limit=2&offset=0" 200
expect history-paged '[.history[].progress]' '[30,60]'
req history-offset1  GET  "/users/$USER_ID/books/$BA/progress?limit=5&offset=1" 200
expect history-offset1 '[.history[].progress]' '[60,10,160]'
req history-limit0   GET  "/users/$USER_ID/books/$BA/progress?limit=0&offset=0" 200
expect history-limit0 '[.history[].progress]' '[]'
# total_progress は本の派生値なのでページングとは独立
expect history-limit0 '.total_progress' '160'

req today            GET  "/users/$USER_ID/books/$BA/progress/today" 200
expect today '.progress' '160'
req today-404        GET  "/users/$USER_ID/books/$(uuid)/progress/today" 404
req by-date          GET  "/users/$USER_ID/books/$BA/progress/date/$TODAY_JST" 200
expect by-date '.progress' '160'
req by-date-empty    GET  "/users/$USER_ID/books/$BA/progress/date/2000-01-01" 200
expect by-date-empty '.progress' '0'
req prog-404         POST "/users/$USER_ID/books/$(uuid)/progress" 404 '{"page_reached":1}'

# 既知バグ #4 修正済み: book_pages = 0 は 500 ではなく比 0 として通る
req zero-page-prog   POST "/users/$USER_ID/books/$BB/progress" 200 '{"page_reached":1}'
expect zero-page-prog '[.total_progress,.tree_ratio,.tree_state]' '[1,0,1]'

echo
echo "== ISBN 照会 =="
# 外部 (国会図書館) に出るので、ネットワークが無い環境では落ちる。
req isbn-lookup      GET  /isbn/9784873115658 200
expect isbn-lookup '.isbn' '"9784873115658"'
# ページ数は進捗率の分母。ここが取れないと機能の意味が無い。
expect isbn-lookup '.pages' '237'
# ISBN-10 のハイフン付きでも 13 桁に正規化して受ける
req isbn-isbn10      GET  /isbn/4-10-101001-3 200
expect isbn-isbn10 '.isbn' '"9784101010014"'
# 日本の書籍バーコードの下段 (192…) は本の ISBN ではないので弾く
req isbn-lower-row   GET  /isbn/1920079009003 422
expect isbn-lower-row '[.detail[].loc]' '[["path","isbn"]]'
req isbn-garbage     GET  /isbn/12345 422
# 形式は正しいが未登録
req isbn-not-found   GET  /isbn/9789999999991 404
expect isbn-not-found '.detail' '"Book not found"'

echo
echo "== validation (422) =="
req bad-uuid-param   GET  /users/abc/books 422
expect bad-uuid-param '[.detail[].loc]' '[["path","user_id"]]'
req bad-book-param   GET  "/users/$USER_ID/books/abc" 422
expect bad-book-param '[.detail[].loc]' '[["path","book_id"]]'
req bad-date         GET  "/users/$USER_ID/books/$BA/progress/date/2026-02-30" 422
expect bad-date '[.detail[].loc]' '[["path","target_date"]]'
req bad-body         PUT  "/users/$USER_ID/books" 422 \
	"{\"book_id\":\"$(uuid)\",\"book_title\":\"x\",\"status\":\"s\",\"book_pages\":null}"
expect bad-body '[.detail[].loc]' '[["body","book_pages"]]'
# 主キーをサーバに採番させない契約なので、id 欠落は 422
req missing-book-id  PUT  "/users/$USER_ID/books" 422 \
	'{"book_title":"x","status":"s","book_pages":1}'
expect missing-book-id '[.detail[].loc]' '[["body","book_id"]]'
req missing-user-id  PUT  /users 422 '{"username":"x"}'
expect missing-user-id '[.detail[].loc]' '[["body","user_id"]]'

echo
if [ "$FAIL" -eq 0 ]; then
	echo "API SPEC OK   (artifacts: $OUT)"
else
	echo "API SPEC FAILED   (artifacts: $OUT)"
fi
exit "$FAIL"
