"use client";

import { TabBar } from "components/TabBar";
import type { ReactNode } from "react";
import { YStack } from "tamagui";

/**
 * 旧 app/(tabs)/_layout.tsx 相当。
 * (tabs) は Next の route group なので URL にセグメントを足さない ＝ 旧 expo-router と同じ。
 *
 * 旧 (main-pages) のネストした Stack はこの層に畳んだ。各ページのタイトルは
 * components/PageHeader.tsx が描く。
 */

/**
 * TabBar が占める高さ。
 *
 * バー自体は 56px だが、中央の「記録」ボタンは height 64 に translateY(-16px) が
 * 掛かっていて**バーより 20px 上へはみ出す**。そこまで避けないと、縦に長い
 * ページの末尾にあるボタンがその円に覆われて押せない (実測で確認)。
 */
const TAB_BAR_SPACE = 56 + 20 + 4;

export default function TabsLayout({ children }: { children: ReactNode }) {
	return (
		<YStack height="100vh" bg="$background">
			{/*
			 * 中身はここでスクロールさせる。
			 *
			 * **`minH={0}` が要る。** flex 子の既定は `min-height: auto` で、内容より
			 * 小さくならないため overflow が効かず、はみ出したぶんが TabBar の下に
			 * 隠れるだけになる (`pb` を足しても直らない。実測済み)。
			 *
			 * 余白ではなく「場所を確保する」形にしているのも同じ理由。padding だと
			 * 内容がその中に描かれてしまい、ボタンがバーの上に来ることを保証できない。
			 */}
			<YStack flex={1} minH={0} style={{ overflowY: "auto" }}>
				{children}
			</YStack>
			{/* TabBar は position: fixed なので、フローの中に場所だけ空けておく */}
			<YStack height={TAB_BAR_SPACE} />
			<TabBar />
		</YStack>
	);
}
