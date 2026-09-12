"use client";

import { useAuth } from "context/AuthContext";
import { useLocalDb } from "context/LocalDbContext";
import {
	refreshSyncState,
	type SyncState,
	subscribeSync,
	sync,
	syncState,
} from "lib/local/sync";
import { useEffect, useState } from "react";
import { Text, XStack } from "tamagui";

/**
 * 同期の状態を出し、同期の契機も持つ。
 *
 * 端末内 DB が作業用の正なので、同期は「いつか終わる裏の処理」でよい。
 * ただし**未送信が何件あるかは見えている必要がある**。見えないと、
 * ユーザーは同期されたと思って端末を初期化してしまう。
 *
 * 契機:
 *   - DB の準備ができたとき
 *   - オンラインに復帰したとき
 *   - タブが見えている間は 30 秒ごと
 *
 * navigator.onLine はヒントでしかない (キャプティブポータルや死んだ VPN で
 * true になる) ので、実際の判定は sync() 内のリクエスト失敗に委ねている。
 */
export function SyncStatus() {
	const { userId } = useAuth();
	const { ready } = useLocalDb();
	const [state, setState] = useState<SyncState>(syncState());

	useEffect(() => subscribeSync(setState), []);

	useEffect(() => {
		if (!userId || !ready) return;

		let stopped = false;
		const run = () => {
			if (!stopped) void sync(userId);
		};

		void refreshSyncState();
		run();

		window.addEventListener("online", run);
		const timer = setInterval(() => {
			if (document.visibilityState === "visible") run();
		}, 30_000);

		return () => {
			stopped = true;
			window.removeEventListener("online", run);
			clearInterval(timer);
		};
	}, [userId, ready]);

	if (!userId) return null;

	const label = state.running
		? "同期中…"
		: state.failed > 0
			? `同期できない記録が ${state.failed} 件`
			: state.pending > 0
				? `未同期 ${state.pending} 件`
				: state.lastSyncedAt
					? "同期済み"
					: "";

	if (!label) return null;

	return (
		<XStack
			position="fixed"
			t="$3"
			r="$3"
			px="$2.5"
			py="$1.5"
			rounded="$10"
			bg="$background"
			borderWidth={1}
			borderColor="$borderColor"
			z={50}
			items="center"
			gap="$1.5"
		>
			<Text
				fontSize={11}
				color={state.failed > 0 ? "$red10" : "$gray11"}
				id="sync-status"
				// テストや調査から未送信件数を直接見られるようにしておく
				data-pending={state.pending}
				data-failed={state.failed}
			>
				{label}
			</Text>
		</XStack>
	);
}
