# 2026_IE-Hicoder-kinki.u_team.d

読書進捗トラッカー。本を登録して読んだページ数を記録すると「木」が育つ。

**Next.js 16 (App Router) + Tamagui v2 + Drizzle ORM + PostgreSQL の単一アプリ。**
UI と API が同一オリジン (`:3000`) で動く。

> 以前は Expo (expo-router) のフロントと FastAPI のバックエンドに分かれていたが、
> どちらも廃止して Next.js に統合した。旧バックエンドのリポジトリ
> `2026_IE-Hicoder-kinki.u_team.d_backend` はもう起動する必要はない。

## 開発の始め方

```bash
cp .env.example .env.local   # 値をチームで決めたものに書き換える
bun install
docker compose up -d db      # Postgres (ホストの 5432 を使う)
bun run db:migrate           # スキーマ適用
bun run dev                  # http://localhost:3000
```

> **`bunx --bun` が必須**: drizzle-kit は `.env.local` を自分では読まない。
> `db:*` スクリプトは `bunx --bun` 経由なので bun ランタイムが `.env.local` を読み込む。
> `--bun` を落とすと node の shebang で走り `DATABASE_URL` が undefined になる。

## 構成

| パス | 役割 |
|---|---|
| `app/(tabs)/**` | タブ配下の画面 (`/` `/record` `/profile` `/books` `/books-information`) |
| `app/(auth)/register` | 初回のユーザー登録 |
| `app/api/**/route.ts` | API。全ハンドラを `withErrorHandling` で包む |
| `components/TabBar.tsx` | 下部タブバー。expo-router の `<Tabs>` の置き換え |
| `components/PageHeader.tsx` | タイトル + 戻るボタン。ネストした `<Stack>` の置き換え |
| `lib/local/repo.ts` | **UI から見た API**。端末内 DB に対して `lib/domain/**` を直接呼ぶ |
| `lib/local/sync.ts` | サーバ同期。送信 → 取得 → 再計算 |
| `lib/local/outbox.ts` | 未送信キュー。書き込みと同じトランザクションで積む |
| `lib/local/covers.ts` | ISBN から取り込んだ表紙 (data URI) の端末内キャッシュ。**同期しない** |
| `lib/isbn/normalize.ts` | ISBN の正規化とページ数抽出。純関数 (サーバ / 端末で共用) |
| `lib/isbn/ndl.ts` | 国会図書館 OpenSearch のパース。fetch は持たない (テストのため分離) |
| `lib/server/ndl.ts` | ISBN から書誌を引く。`server-only` |
| `components/BarcodeScanner.tsx` | バーコード読み取りの全画面オーバーレイ (`@zxing/browser`) |
| `lib/domain/sync.ts` | 同期の適用 (upsert)。対話 API とは意味論が違うので分けてある |
| `lib/local/db.ts` | 端末内 PostgreSQL (PGlite)。タブ排他・スキーマ世代・書き込みの押し出し |
| `lib/domain/**` | **業務ロジック**。DB ハンドルを引数に取る純関数。サーバでもブラウザでも動く |
| `lib/schema.ts` | Drizzle スキーマ (`users` / `books_list` / `progress`)。主キーは uuid |
| `lib/uuid.ts` | UUIDv7 生成。主キーはクライアントが作る |
| `lib/server/db.ts` | 接続プール (dev の HMR 対策で `globalThis` にキャッシュ)。`server-only` |
| `lib/http.ts` | エラー応答 (`{detail}` / 422 / 500 plain text) |
| `lib/jst.ts` | JST の日境界計算 (Asia/Tokyo は固定 UTC+9) |
| `lib/serialize.ts` | レスポンス整形。未知キーを strip して返す |
| `schemas/openapi.ts` | **API 契約の正**。UI とサーバの両方がこれを参照する |

### 知っておくべきこと

- **Tamagui を描くページ / レイアウトには `"use client"` が要る。**
  付けないと `next build` の page data 収集で `TypeError: c is not a function` になる。
- **`react-native` / `react-native-web` はアプリの依存に入れない。** Tamagui の web ビルドは
  どちらも使わない (`tamagui` の peer は `react` だけ)。`bunfig.toml` の
  `[install] peer = false` が、native 専用パッケージ経由で react-native が入るのを止めている。
  `react-native` を import するとビルドが `Module not found` で落ちる ＝ それが正しい状態。
- **アイコンは必ずサブパス import する** (`@tamagui/lucide-icons-2/icons/Plus`)。
  バレル import は約 1,700 アイコンぶんのモジュールをグラフに入れる。
- **`tamagui build` は対象ディレクトリのソースを「その場で書き換える」。**
  `bun run build` が `-- next build` の形になっているのはそのため。`--` を付けると
  コマンド実行後に CLI が自動でソースを復元し、一時生成した `_*.css` も消す
  （CLI の `--help` に明記されている）。**`--` を外すとコンパイル済みのソースが
  そのまま残り、再実行するたび `import "./_page.css"` が積み重なる。**
  CSS だけ作り直したいときは `bun run tamagui:css`（`tamagui generate-css`）を使う。
  こちらはソースを触らない。
- **`app/tamagui.generated.css` はコミットする。** `app/layout.tsx` が静的 import
  するので、コミットしないとクリーンチェックアウトで `Module not found` になる。

## オフラインファースト

**データの正は端末内にある。** UI は `lib/local/repo.ts` 経由で端末内の
PostgreSQL (PGlite / WASM) を直接読み書きし、HTTP は経由しない。
`app/api/**` は残っているが、いまは仕様テストの対象とサーバ同期の受け口で、
UI からは呼んでいない。

```
                     ┌─ app/api/**/route.ts  ── lib/server/db.ts (pg.Pool)
lib/domain/*.ts ─────┤                              └─ サーバ PostgreSQL
 (db ハンドルを取る)   │
                     └─ lib/local/repo.ts ───── lib/local/db.ts (PGlite idb://)
                                                    └─ 端末内 PostgreSQL ← 作業用の正
```

`DomainDb` は `NodePgDatabase` / `PgliteDatabase` / `PgTransaction` を
キャスト無しで受ける。**同じ業務ロジックがサーバでもブラウザでも動く**のが
SQLite ではなく PGlite を選んだ理由。

### 踏むと痛い落とし穴

- **PGlite はバンドルしない。** Turbopack は `@electric-sql/pglite` を
  バンドルすると**本番ビルドでのみ**実行時に落ちる
  (`TypeError: <x>.instantiateWasm is not a function`)。`next dev` では動くので
  dev は何の証明にもならない。`scripts/copy-pglite.sh` が実体を `public/pglite/`
  へ置き、`import(/* turbopackIgnore: true */ "/pglite/index.js")` で読む。
  `drizzle-orm/pglite` も同じパッケージを import するので、
  `turbopack.resolveAlias` で `lib/local/pglite-stub.ts` に差し替えてある。
- **書き込みは明示的に押し出す。** PGlite の IndexedDB 保存は既定で遅延し、
  **書き込み直後にリロードすると行が消える**（実測: 0 秒後のリロードで消え、
  3 秒待てば残る。オンライン / オフラインを問わない）。
  `relaxedDurability: false` だけでは足りないので、`lib/local/repo.ts` の
  書き込み系はすべて `flushLocalDb()` を待つ。
- **2 タブ目は開かせない。** PGlite は IndexedDB 上で単一接続前提で、
  2 タブが同時に書くと**例外を出さずに**片方の書き込みが消える（実測）。
  `navigator.locks` で弾き、画面に理由を出す。
- **PGlite の初期化はマウント後に。** 全ページ `"use client"` だが Next は
  クライアントコンポーネントもビルド時にプリレンダリングするので、
  モジュールスコープで開くと `next build` 中の Node で動いてしまう。
- **Service Worker が無いとオフラインでは何も開けない。** 端末内 DB があっても
  ブラウザのエラー画面越しには到達できない。`public/sw.js`
  (`scripts/gen-sw.ts` が生成) がシェルと `/pglite/*` を配る。
  App Router のクライアント遷移は RSC ペイロード (`?_rsc=`) を取りに行くので、
  HTML だけキャッシュするとタブを押した瞬間に落ちる。両方キャッシュしている。
- **外部画像は使わない。** 表紙やアバターは `lib/placeholder.ts` のデータ URI。
  外部 URL にするとオフラインで確認したい画面だけ画像が壊れる。
  木の画像も `next/image` の最適化を通すと `/_next/image?url=` になるので
  `unoptimized` にしている。ISBN から取り込んだ実表紙も、サーバ側で
  base64 の data URI にしてから端末内 `book_covers` に置いている。
- **ローカル専用テーブルの追加は新しい `000N_local.sql` を作る。**
  既に起動したことのある端末は `_local_migrations` に `local_0000` を記録済みで、
  そのファイルは**二度と実行されない**。追記しても新しい端末でしか効かず、
  既存の端末だけ静かに壊れる。`scripts/gen-migrations.ts` の `sources` にも足すこと。
- **国会図書館のサムネイルは `Referer` が要る。**
  `https://ndlsearch.ndl.go.jp/thumbnail/{isbn}.jpg` は `Referer:
  https://ndlsearch.ndl.go.jp/` が無いと 403 を返す (User-Agent は無関係。
  切り分け済み)。OpenSearch もサムネイルも **CORS ヘッダを返さない**ので、
  ブラウザから直接は叩けない。`/api/isbn/[isbn]` が唯一の経路。
- **バーコードのライブラリは純 JS のものを選ぶ。** `barcode-detector` や
  `zxing-wasm` 系は WASM で、PGlite で踏んだ Turbopack のバンドル問題を
  そのまま繰り返す。`@zxing/browser` は WASM を持たない (`.next` の wasm は 0 個)。
- **カメラはセキュアコンテキストでしか使えない。** スマホから
  `http://192.168.x.x:3000` で開くと `navigator.mediaDevices` が `undefined` になる。
  実機確認は Vercel のプレビュー URL か `next dev --experimental-https` で。

### サーバ同期

端末内 DB が作業用の正で、サーバは同期先兼バックアップ。
`lib/local/sync.ts` が送信 → 取得 → 再計算を 1 往復ぶん行う。

- **送信**: 書き込みと**同じトランザクション**で `outbox` に積む。
  `id` は uuidv7 なので **id 昇順 = 因果順**になり、そのまま送信順に使える
  （`book.create` が必ずその本の `progress.record` より先に届く）。
  一時的な失敗が出たらそこで止めて順序を守り、二度と成功しないものは
  dead letter にして先へ進む。
- **取得**: `GET /api/sync/pull?user_id=` が**そのユーザーの全行**を返す。
  差分は取らない — `created_at` / `updated_at` は端末が生成した値なので
  透かしに使えない（端末 A が火曜にオフラインで記録して木曜に送ると、
  「木曜より新しい行」で絞った瞬間その行は永久に届かない）。
  行数は 1 ユーザーぶんの数十行で、`progress` は id 一致で無視、
  `users`/`books` は `updated_at` の新しい方を採るので**全件でも冪等**。
- **競合**: `progress` は追記のみなので原理的に競合しない。2 端末の記録は
  自然に合算される。可変なのは `users.username` と `books_list` の行だけで、
  **端末が押した `updated_at`** の新しい方が勝つ（サーバが `now()` を打つと
  編集順ではなく到着順で勝者が決まってしまう）。
- **派生カラムは運ばない**。`total_progress` / `tree_ratio` / `tree_state` /
  `number_of_books` は受け側で数え直す。普通のカラムとして同期すると
  2 端末でオフライン記録したとき片方が消える。

`POST /api/sync/push` は **op ごとに SAVEPOINT** を張る。平坦な 1 トランザクション
だと 1 件の失敗がバッチ全体を巻き戻し、`withErrorHandling` がプレーンテキストの
500 を返すので、端末はどれが失敗したか分からないまま同じバッチを永久に再送する。

ElectricSQL は使っていない。読み取り同期しか提供せず、書き出しも競合解決も
結局自前になるうえ、同期サービスのコンテナと論理レプリケーションが要る。
3 テーブル・数百行・1 端末 1 ユーザーには重すぎる。

> **同期中に来た書き込みは捨てずにキューする。** 走行中の要求を現在の実行に
> 相乗りさせるだけだと、同期の最中に書いた行が取り残されて次の契機
> （30 秒間隔）まで送られない。

### 認証 — ログイン画面は無いが user_id は資格情報ではない

オフラインのまま新規登録できることを壊さずに認証を入れる必要があった。
サーバが秘密を発行するとその時点でオンライン必須になるので、**端末が作る**。

1. 登録時、端末が 256bit の乱数（端末シークレット）を作り、端末内 DB に置く
2. 初めてオンラインになったとき `POST /api/auth/claim` でそれを提示し、
   `user_id` を**確保**する。**先着が所有者**になる。`user_id` は端末内で
   生成され確保するまでネットワークに出ないので、先回りされることはない
3. 以後は httpOnly cookie のセッションで認証する。
   **`user_id` は資格情報として扱わない**

| | |
|---|---|
| `GET /api/sync/pull` | **`user_id` を受け取らない**。セッションの持ち主のぶんだけを返す |
| `POST /api/sync/push` | 他人の `user_id` を指す op は `rejected` |
| `/api/users/:uid/**` | セッションの持ち主と一致しなければ 403（存在の有無すら返さない） |

秘密もセッショントークンも 256bit の乱数なので、パスワードと違って総当たりの
余地がない。よって遅いハッシュ（bcrypt 等）は不要で、DB 流出時に原文を守れれば
十分なため SHA-256 を使っている。

同期のペイロードには**同期に不要な個人情報を載せない**。`user_mail_address` は
運ばず pull でも返さない（UI から設定する経路も無い）。

**パスワードログインにしなかった理由**: ログイン ID を username にすると
一意性が要るが、その一意索引は「2 端末が同じ名前でオフライン登録すると
2 台目の同期が永久に詰まる」ため意図的に落としてある。一意性を保証するには
登録時にサーバへ到達する必要があり、オフライン登録ができなくなる。

### 別の端末で続きを使う

1 台目のプロフィール画面で**引き継ぎコード**を発行し、2 台目の登録画面に
入力する。コードは **10 分で失効し 1 回だけ**使える。
成功するとサーバが 2 台目にもセッションを張り、そのまま pull で中身が埋まる。

ユーザー ID を入力させる方式にはしていない。それだと ID が実質の資格情報に
なり、引き継ぎのために画面に出す値で他人のデータが読めてしまう。

合流だけはオフラインではできない（サーバがセッションを張るため）。
引き継ぎコードで入った端末はアカウントの秘密を知らないので、
cookie が切れたら 1 台目でコードを発行し直す。

## 主キーは UUIDv7・クライアント生成

3 テーブルの主キーはすべて `uuid` で、**値はクライアントが `lib/uuid.ts` の `uuidv7()` で作る**。
スキーマに `.defaultRandom()` は**付けない**。

- サーバに採番させると、オフラインの端末は登録も書籍追加もできない
  （`AuthGuard` は `user_session` が無ければ必ず `/register` に飛ばす）
- 採番させた id はクライアントに伝わらないので、同期の再送が重複行を作る。
  デフォルト無しなら NOT NULL 違反として即座に落ちる
- **v4 (`crypto.randomUUID()`) ではなく v7** を使う。履歴は `orderBy(asc(progress_id))` で
  並べており、ランダムな v4 はこの順序を壊す。v7 は先頭 48bit がミリ秒なので
  「主キー昇順 = 作成順」が保たれる。同一ミリ秒内も連番で単調増加させている

`ix_users_username`（unique）は**意図的に持たない**。2 端末が同じ名前でオフライン登録すると
2 台目が同期で unique 違反になり、順序を保つ送信キューがそこで永久に詰まる。
このアプリに username でのログインは無いので、この索引は何も買っていない。

## 修正済みの既知バグ

旧 FastAPI から**バグごと逐語的に再現**して移植したが、移植の正しさは
`scripts/parity.sh` の 35 ケース差分ゼロで確認済みで、FastAPI も退役したため、
再現をやめて修正した:

| 内容 | 修正後 |
|---|---|
| 読了しても `tree_ratio` が 99 止まりで木が最終段階にならなかった（`1e-8` 由来） | `120/120` が 100 になり `tree_state: 3` に到達する。**`tree_3.png` が表示されるのはこれが初めて** |
| `book_pages` が 0 の本に進捗を記録すると 500（比が約 100 億になり int4 を溢れていた） | 比 0 として 200 |
| 存在しないユーザへの `PATCH /api/users/{id}` が 500 | 404 `{"detail":"User not found"}` |
| 本の `status` が無視され常に `積読` | 保存される。UI にも状態選択を追加 |
| `GET .../progress` の `limit` が無視され `offset>=1` で 404 | `progress` 行に正しく適用 |
| `ProgressTree` が表示する本の ID を `5` に固定 | 一覧の最後の本を使う |

`60/120` は 49 → **50**、`120/120` は 99 → **100** に変わっている。退行ではない。

## デプロイ

**Node が動くホストが要る。** `app/api/**` は 15 本すべて動的ハンドラなので、
GitHub Pages のような静的ホスティングでは同期と認証が動かない。

UI とオフライン動作だけなら `output: "export"` で静的書き出しできることは
実際に確認したが、その場合サーバ側は丸ごと失われる。やるなら
`app/manifest.ts` に `export const dynamic = "force-static"` が要る
（通常ビルドでは manifest は元から静的なので、この指定は export のときだけ意味を持つ）。

### Vercel の場合

Route Handler はサーバレス関数として動く。edge ランタイムの指定はしていないので
Node ランタイムになり、`pg` も `node:crypto` もそのまま使える。

手順:

1. **PostgreSQL を用意する**（Vercel は DB を持たないので Neon / Supabase 等）。
   `DATABASE_URL` は**接続プーラ経由**のものにすること
   （Neon なら `-pooler` 付き、Supabase ならポート 6543）。
2. `DATABASE_URL` を環境変数に設定する。
3. **マイグレーションを流す**（自動では走らない）:
   `DATABASE_URL=<本番> bunx --bun drizzle-kit migrate`
4. デプロイ。ビルドは `package.json` の `build` がそのまま使われる
   （`prepare-local` が PGlite の実体コピー・マイグレーション焼き込み・
   Service Worker 生成を行うので、この順序を崩さないこと）。

注意点:

- **接続プールはサーバレスを検出して 1 本にしている**（`lib/server/db.ts`）。
  サーバレスは水平に増えるので、インスタンスごとに 10 本張ると Postgres の
  接続上限をすぐ使い切る。
- セッション cookie の `Secure` は `NODE_ENV=production` で自動的に付く。
- `public/pglite/` は約 18MB の静的アセット。ビルド時に生成されコミットしない。

### GitHub Pages に UI だけ置く場合

サーバを別ホストに置き、UI だけ Pages に出すこともできるが、
**cookie が cross-origin になる**ので `SameSite=None; Secure` と
オリジンを明示した CORS（`*` は credentials と併用不可）が要る。
さらにプロジェクトページはサブパス配信になるため、`basePath` / `assetPrefix` と、
絶対パスで書いている箇所（`/pglite/index.js` の import、`/sw.js` の登録、
`public/sw.js` 内の `SHELL` と `/pglite/` 判定、manifest の `start_url`）を
すべてサブパス対応にする必要がある。

## 検証

| | |
|---|---|
| `bun run test:unit` | `lib/domain/**` をインメモリ PGlite に対して検証。**Docker 不要**、数秒 |
| `bun run api-spec` | HTTP 層（ステータス / 404・422 のボディ形 / シリアライズ）。空の DB を向けて実行 |
| — | 同期は `lib/domain/sync.test.ts`（2 つの PGlite を端末とサーバに見立てて行を往復させる）と `tests/sync.test.ts`（2 つの browser context を 2 台の端末に見立てる）で見る |
| `bun run test` | Playwright。`build && start` してからブラウザで叩く。オフライン動作もここで見る |

`playwright.config.ts` は `reuseExistingServer: true` なので、**手で起動した
サーバが残っていると古いビルドのまま走る**。挙動が変わらないときはまず疑うこと。

`scripts/api-spec.sh` はもともと FastAPI と Next.js の差分を見る `scripts/parity.sh` だった。
移植が終わって比較相手が消え、主キーの UUID 化で契約も変わったので、
35 ケースという資産を残したまま期待値を直接書く仕様テストに作り替えてある。

移植時に効いた知見:

- **500 は plain text**。Starlette が `Internal Server Error` をそのまま返すので JSON にしない。
- **`sum()` は SQL 側で `::int` にキャストする**。pg は bigint を文字列で返すため。
- **`Math.trunc`** を使う（Python の `int()` と同じ 0 方向切り捨て）。
