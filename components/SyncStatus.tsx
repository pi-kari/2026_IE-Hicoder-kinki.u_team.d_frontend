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

	// **同期済みのときは何も出さない。** 全部送れているのが通常の状態なので、
	// 常時チップが出ていると画面の邪魔になるだけで、何も知らせていない。
	// 出すのは「まだ送れていない」「送れなかった」「今送っている」ときだけ。
	const label = state.running
		? "同期中…"
		: state.failed > 0
			? `同期できない記録が ${state.failed} 件`
			: state.pending > 0
				? `未同期 ${state.pending} 件`
				: "";

	// 件数はテストや調査から直接見たいので、表示しないときも DOM には残す。
	// ここで return null にすると #sync-status ごと消え、同期の完了を
	// 待つテスト (data-pending が 0 になるのを見る) が要素を見失う。
	return (
		<XStack
			id="sync-status"
			data-pending={state.pending}
			data-failed={state.failed}
			position="fixed"
			t="$3"
			r="$3"
			z={50}
			items="center"
			gap="$1.5"
			{...(label
				? {
						px: "$2.5",
						py: "$1.5",
						rounded: "$10",
						bg: "$background",
						borderWidth: 1,
						borderColor: "$borderColor",
					}
				: { display: "none" as const })}
		>
			{label ? (
				<Text fontSize={11} color={state.failed > 0 ? "$red10" : "$gray11"}>
					{label}
				</Text>
			) : null}
		</XStack>
	);
}
