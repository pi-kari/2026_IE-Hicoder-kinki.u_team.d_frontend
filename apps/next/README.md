# hicoder-api (Next.js)

旧 FastAPI バックエンド (`2026_IE-Hicoder-kinki.u_team.d_backend`) を置き換える API サーバ。
Next.js 16 の App Router Route Handlers + Drizzle ORM + PostgreSQL。

**Phase 1 の方針は「純粋な移植」**。既知バグも含めて FastAPI と同じ応答を返すことだけを目指している。
挙動の改善は Phase 3 で行う。詳細と各バグの一覧は移行計画を参照。

## セットアップ

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

> 旧バックエンドの compose と**ホストの 5432 を取り合う**ので同時起動しないこと。

## Expo アプリ側

`EXPO_PUBLIC_BACKEND_URL` を **`/api` 付き**にする（リポジトリルートの `.env.local`）:

```
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000/api
```

FastAPI は `/users` だったが Route Handler は `app/api/…` なので `/api/users` になる。
この差は環境変数だけで吸収しており、画面側の URL 組み立てコードは変更していない。

`EXPO_PUBLIC_*` は**バンドル時にインライン展開される**ため、書き換えたら
`bun run start:clean` (`expo start -c`) が必要。warm cache は古い URL を配り続ける。

## パリティ検証

FastAPI と新 API に同じリクエスト列を投げて JSON を比較する。**差分ゼロが合格**。

```bash
# 2 つの空 DB を用意する（同一 DB だと unique 衝突と serial のズレで差分がノイズになる）
docker compose exec db psql -U postgres -c 'CREATE DATABASE parity_fastapi'
docker compose exec db psql -U postgres -c 'CREATE DATABASE parity_next'
# 旧スタックを parity_fastapi、新スタックを parity_next に向けて起動してから
OLD=http://localhost:8000 NEW=http://localhost:3000/api ./scripts/parity.sh
```

## 構成

| パス | 役割 |
|---|---|
| `app/api/**/route.ts` | エンドポイント。全ハンドラを `withErrorHandling` で包む |
| `lib/schema.ts` | Drizzle スキーマ（`users` / `books_list` / `progress`） |
| `lib/db.ts` | 接続プール（dev の HMR 対策で `globalThis` にキャッシュ） |
| `lib/http.ts` | FastAPI 互換のエラー応答（`{detail}` / 422 / 500 plain text） |
| `lib/jst.ts` | JST の日境界計算（Asia/Tokyo は固定 UTC+9） |
| `lib/requests.ts` | リクエストボディ検証（Pydantic の定義に対応） |
| `lib/contract.ts` | レスポンス整形用スキーマ。`schemas/openapi.ts` のコピー |
| `lib/serialize.ts` | `response_model` 相当。未知キーを strip して返す |

### 移植上の注意

- **500 は plain text**。Starlette が `Internal Server Error` をそのまま返すので JSON にしない。
- **`sum()` は SQL 側で `::int` にキャストする**。pg は bigint を文字列で返すため。
- **`Math.trunc`** を使う（Python の `int()` と同じ 0 方向切り捨て）。`1e-8` のガードごと再現しており、
  `60/120` が 49、`120/120` が 99 になる癖も意図的にそのまま。
