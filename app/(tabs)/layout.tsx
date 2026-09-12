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
export default function TabsLayout({ children }: { children: ReactNode }) {
	return (
		<YStack flex={1} minH="100vh" bg="$background">
			{/* TabBar は position: fixed なので、その高さ分だけ下に余白を空ける */}
			<YStack flex={1} pb={56}>
				{children}
			</YStack>
			<TabBar />
		</YStack>
	);
}
