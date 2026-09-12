"use client";

import "./_layout.css"
const _cn2 = "is_View _fd-column _grow-1 _shrink-1 _fb-0px _pb-56px";
const _cn = "is_View _fd-column _grow-1 _shrink-1 _fb-0px _minH-100vh _bg-background";
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
export default function TabsLayout({
  children
}: {
  children: ReactNode;
}) {
  return <div className={_cn}>
			{/* TabBar は position: fixed なので、その高さ分だけ下に余白を空ける */}
			<div className={_cn2}>
				{children}
			</div>
			<TabBar />
		</div>;
}