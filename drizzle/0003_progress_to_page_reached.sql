-- progress.progress の意味を変える。
--   旧: その回に読んだページ数 (加算)     total_progress = SUM
--   新: その回に読み終わったページ番号     total_progress = MAX
--
-- 既存行は「先頭からの累積和」に置き換える。これで意味が揃うだけでなく、
-- **派生カラムも書き換えずに済む**: 累積和の最大値 = もとの合計 なので、
-- total_progress / tree_ratio / tree_state は今の値のまま正しい。
-- 日別の集計 (getProgressOnDay) も「日末の到達位置 − 日初の到達位置」に
-- 変わるが、累積和なら変換前の日別合計と一致する。
--
-- progress_id は uuidv7 なので昇順 = 作成順。created_at は端末が打つ値で
-- 端末間の時計ずれを含むため、順序付けには使わない。
WITH cumulative AS (
	SELECT
		progress_id,
		SUM(progress) OVER (
			PARTITION BY book_id
			ORDER BY progress_id
			ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
		) AS position
	FROM progress
)
UPDATE progress AS p
SET progress = c.position
FROM cumulative AS c
WHERE p.progress_id = c.progress_id;
