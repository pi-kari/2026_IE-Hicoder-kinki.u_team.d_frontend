-- ローカル専用テーブル。サーバには存在しない。
-- drizzle-kit には食わせないので手で維持する。
--
-- outbox: オフライン中の書き込みを貯め、オンライン復帰時にサーバへ送る。
-- id は uuidv7 なので「id 昇順 = 因果順」になり、そのまま送信順に使える。
-- これにより book.create が必ずその本の progress.record より先にサーバへ届く
-- (サーバ側には実 FK がある)。
CREATE TABLE IF NOT EXISTS outbox (
	id          uuid PRIMARY KEY,
	op          text NOT NULL,
	entity_id   uuid NOT NULL,
	payload     jsonb NOT NULL,
	created_at  timestamptz NOT NULL DEFAULT now(),
	attempts    integer NOT NULL DEFAULT 0,
	next_try_at timestamptz NOT NULL DEFAULT now(),
	failed_at   timestamptz,
	last_error  text
);
CREATE INDEX IF NOT EXISTS ix_outbox_pending ON outbox (id) WHERE failed_at IS NULL;
