# 2026_IE-Hicoder-kinki.u_team.d

読書進捗トラッカー。本を登録して読んだページ数を記録すると「木」が育つ。

| | 中身 |
|---|---|
| リポジトリルート | Expo SDK 55 + expo-router + Tamagui v2（iOS / Android / Web） |
| `apps/next/` | Next.js 16 の API サーバ + PostgreSQL（旧 FastAPI の置き換え） |

> **FastAPI バックエンドは廃止しました。** API は `apps/next/` に移行済みです。
> 旧リポジトリ `2026_IE-Hicoder-kinki.u_team.d_backend` はもう起動する必要はありません。

## 開発の始め方（ターミナル 2 つ）

**1. API + DB**

```bash
cd apps/next
cp .env.example .env.local     # 値をチームで決めたものに書き換える
bun install
docker compose up -d db
bun run db:migrate
bun run dev                    # http://localhost:3000
```

**2. Expo アプリ**

```bash
cp .env.example .env.local     # EXPO_PUBLIC_BACKEND_URL=http://localhost:3000/api
bun install
bun run start
```

`.env.local` を書き換えたときは `bun run start:clean`（`expo start -c`）で起動すること。
`EXPO_PUBLIC_*` はバンドル時にインライン展開されるため、キャッシュが残っていると古い URL を配り続ける。

## 構成メモ

- **API のベース URL は `/api` 付き**。FastAPI は `/users` だったが Next の Route Handler は
  `app/api/…` なので `/api/users` になる。差は環境変数だけで吸収しており、画面側のコードは変えていない。
- **`apps/next` は独立した bun プロジェクト**（まだワークスペースではない）。そのため
  `metro.config.js` の `blockList` と ルート `tsconfig.json` の `exclude` で Metro と tsc から除外している。
  この 2 つを外すと Metro が Next の `node_modules` をクロールして `react-native` の重複解決で壊れる。
- API 側の詳細・移植上の注意は [`apps/next/README.md`](./apps/next/README.md) を参照。

## 既知の問題

移行時に FastAPI の挙動をそのまま再現しているため、以下は**意図的に残している**（別途修正予定）:

- 本を最後まで読んでも `tree_ratio` は 99 止まりで木が最終段階にならない（`1e-8` 由来）
- `book_pages` が 0 の本に進捗を記録すると 500
- 存在しないユーザへの `PATCH /users/{id}` が 404 ではなく 500
- 本の `status` は送っても無視され、常に `積読` になる
- `GET .../progress` の `limit` は無視され、`offset>=1` だと 404
- `components/ProgressTree.tsx` が表示する本の ID を `5` に固定している
