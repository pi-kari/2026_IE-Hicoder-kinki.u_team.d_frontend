-- ローカル専用テーブル (第 2 弾)。サーバには存在しない。
--
-- **0000_local.sql に追記してはいけない。** 既に起動したことのある端末は
-- _local_migrations に local_0000 を記録済みで、あのファイルは二度と実行されない。
-- ローカル専用の追加は必ず新しい 000N_local.sql を作ること。
--
-- book_covers: ISBN から取得した表紙を data URI で持つ。
-- **同期しない。** 1 冊あたり数 KB〜数十 KB あり、同期ペイロードとサーバ DB を
-- 膨らませるだけで、books_list.isbn があればいつでも引き直せる。
-- 本ではなく ISBN を主キーにしているのは、同じ本を 2 回登録しても 1 枚で済むから。
CREATE TABLE IF NOT EXISTS book_covers (
	isbn       text PRIMARY KEY,
	data_uri   text NOT NULL,
	fetched_at timestamptz NOT NULL DEFAULT now()
);
