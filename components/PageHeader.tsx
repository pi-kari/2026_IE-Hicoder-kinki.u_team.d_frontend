"use client";

import { ChevronLeft } from "@tamagui/lucide-icons-2/icons/ChevronLeft";
import { useRouter } from "next/navigation";
import { Button, H4, XStack } from "tamagui";

/**
 * 旧 app/(tabs)/(main-pages)/_layout.tsx の <Stack> が出していたヘッダの代替。
 * expo-router のネストした Stack がタイトルと戻るボタンを描いていたが、
 * Next には相当物が無いので同じ見た目を自前で出す。
 */
export function PageHeader({ title }: { title: string }) {
	const router = useRouter();

	return (
		<XStack
			width="100%"
			items="center"
			gap="$2"
			px="$3"
			py="$2"
			borderBottomWidth={1}
			borderColor="$borderColor"
			bg="$background"
		>
			<Button
				size="$3"
				chromeless
				icon={ChevronLeft}
				aria-label="戻る"
				onPress={() => router.back()}
			/>
			<H4>{title}</H4>
		</XStack>
	);
}
