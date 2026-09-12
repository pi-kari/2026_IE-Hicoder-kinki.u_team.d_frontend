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
  `unoptimized` にしている。

### 別の端末で続きを使う

このアプリにログインは無く、`/register` は常に新規ユーザーを作る。
2 台目の端末は、プロフィール画面に出ているユーザー ID を
`/register` の「既存のユーザー ID で続ける」に入れて合流する。
（サーバからのデータ取得は同期フェーズで対応する。）

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

## 検証

| | |
|---|---|
| `bun run test:unit` | `lib/domain/**` をインメモリ PGlite に対して検証。**Docker 不要**、数秒 |
| `bun run api-spec` | HTTP 層（ステータス / 404・422 のボディ形 / シリアライズ）。空の DB を向けて実行 |
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
