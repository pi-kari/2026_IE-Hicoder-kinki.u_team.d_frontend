-- ローカル専用テーブル (第 3 弾)。サーバには存在しない。
--
-- **0000_local.sql / 0001_local.sql に追記してはいけない。** 起動済みの端末は
-- _local_migrations にその tag を記録済みで、あれらは二度と実行されない。
--
-- 未送信の outbox に残っている progress.record の payload を、
-- 0003_progress_to_page_reached と同じ意味に直す。
--
-- これを忘れると、アップデート前にオフラインで記録して未送信だったぶんが
-- 「読んだページ数」のままサーバへ届き、到達位置 (MAX) より小さい値として
-- 黙って捨てられる。progress テーブルは 0003 で既に変換済みなので、
-- そこから写すのが最も確実。
--
-- 0003 はドリズルの journal 側にあり、gen-migrations.ts が生成する配列では
-- local_* より前に並ぶので、ここに来た時点で変換は終わっている。
UPDATE outbox AS o
SET payload = jsonb_set(o.payload, '{progress}', to_jsonb(p.progress))
FROM progress AS p
WHERE o.op = 'progress.record'
  AND p.progress_id = o.entity_id;
