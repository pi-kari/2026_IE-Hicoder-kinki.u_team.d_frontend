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
| `lib/api.ts` | UI 側の API 呼び出し。ベースは相対パスの `/api` |
| `lib/schema.ts` | Drizzle スキーマ (`users` / `books_list` / `progress`) |
| `lib/db.ts` | 接続プール (dev の HMR 対策で `globalThis` にキャッシュ) |
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

## 既知の問題

旧 FastAPI の挙動をそのまま再現しているため、以下は**意図的に残している**（別途修正予定）:

- 本を最後まで読んでも `tree_ratio` は 99 止まりで木が最終段階にならない（`1e-8` 由来）
- `book_pages` が 0 の本に進捗を記録すると 500
- 存在しないユーザへの `PATCH /api/users/{id}` が 404 ではなく 500
- 本の `status` は送っても無視され、常に `積読` になる
- `GET .../progress` の `limit` は無視され、`offset>=1` だと 404
- `components/ProgressTree.tsx` が表示する本の ID を `5` に固定している

## 移植の経緯

FastAPI からの移植は**バグごと逐語的に再現する**方針で行い、`scripts/parity.sh` で
両者に同じリクエスト列を投げて差分ゼロを確認してある（35 ケース）。
旧スタックが消えた今このスクリプトは実行できないが、移植内容の記録として残している。

- **500 は plain text**。Starlette が `Internal Server Error` をそのまま返すので JSON にしない。
- **`sum()` は SQL 側で `::int` にキャストする**。pg は bigint を文字列で返すため。
- **`Math.trunc`** を使う（Python の `int()` と同じ 0 方向切り捨て）。`1e-8` のガードごと
  再現しており、`60/120` が 49、`120/120` が 99 になる癖も意図的にそのまま。
