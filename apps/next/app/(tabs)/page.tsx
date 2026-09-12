"use client";

import "./_page.css"
const _cn = "is_View _fd-column _grow-1 _shrink-1 _fb-0px _items-center _gap-c-space-8 _pr-c-space-10 _pl-c-space-10 _pt-c-space-5 _bg-background";
import { ProgressWidget } from "components/widgets/ProgressWidget";
import { TreeWidget } from "components/widgets/TreeWidget";
import { YStack } from "tamagui";
export default function HomePage() {
  return <div className={_cn}>
			<TreeWidget />
			<ProgressWidget />
		</div>;
}