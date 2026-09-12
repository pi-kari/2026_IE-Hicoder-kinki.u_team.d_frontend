"use client";

import { getLocalDb, SchemaEpochError, TabConflictError } from "lib/local/db";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { H2, Paragraph, YStack } from "tamagui";

/**
 * 端末内 DB (PGlite) の準備状態をアプリ全体に配る。
 *
 * DB を開くには WASM のダウンロードと起動が要る。実測で初回 3〜8 秒、
 * 2 回目以降 1.5 秒程度かかるので、画面側は `ready` を見てから問い合わせる。
 *
 * 初期化はマウント後 (useEffect) に行う。全ページは "use client" だが
 * Next はクライアントコンポーネントもビルド時にプリレンダリングするので、
 * モジュールスコープや描画中に開くと next build の Node 側で実行されてしまう。
 */

type State =
	| { ready: false; error: null }
	| { ready: true; error: null }
	| { ready: false; error: Error };

const LocalDbContext = createContext<State>({ ready: false, error: null });

export function useLocalDb() {
	return useContext(LocalDbContext);
}

export function LocalDbProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<State>({ ready: false, error: null });

	useEffect(() => {
		let cancelled = false;
		getLocalDb().then(
			() => !cancelled && setState({ ready: true, error: null }),
			(e: Error) => !cancelled && setState({ ready: false, error: e }),
		);
		return () => {
			cancelled = true;
		};
	}, []);

	if (state.error) {
		return <BlockingError error={state.error} />;
	}

	return (
		<LocalDbContext.Provider value={state}>{children}</LocalDbContext.Provider>
	);
}

/**
 * DB が開けないときは画面を出さない。
 *
 * 特にマルチタブは危険で、PGlite は IndexedDB 上で単一接続前提のため、
 * 2 タブが同時に書くと**例外を出さずに**片方の書き込みが消える (実測)。
 * 黙って壊れるより、開けないことを見せる方がよい。
 */
function BlockingError({ error }: { error: Error }) {
	const [title, body] =
		error instanceof TabConflictError
			? [
					"このアプリは 1 つのタブでのみ開けます",
					"端末内のデータベースは同時に 1 つのタブからしか触れません。ほかのタブを閉じてから再読み込みしてください。",
				]
			: error instanceof SchemaEpochError
				? [
						"データの作り直しが必要です",
						"アプリの更新で端末内データベースの形式が変わりました。未送信の記録が残っている場合は、オンラインにして同期が終わるのを待ってください。",
					]
				: ["端末内データベースを開けませんでした", error.message];

	return (
		<YStack
			flex={1}
			minH="100vh"
			justify="center"
			items="center"
			gap="$4"
			p="$6"
			bg="$background"
		>
			<H2 text="center">{title}</H2>
			<Paragraph text="center" maxWidth={420}>
				{body}
			</Paragraph>
		</YStack>
	);
}
