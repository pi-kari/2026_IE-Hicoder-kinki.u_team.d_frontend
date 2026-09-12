"use client";

import { ProgressWidget } from "components/widgets/ProgressWidget";
import { TreeWidget } from "components/widgets/TreeWidget";
import { YStack } from "tamagui";

export default function HomePage() {
	return (
		<YStack flex={1} items="center" gap="$8" px="$10" pt="$5" bg="$background">
			<TreeWidget />
			<ProgressWidget />
		</YStack>
	);
}
