"use client";

import { ProgressTree } from "components/ProgressTree";
import { useRouter } from "next/navigation";
import { Button, Card, H2, XStack } from "tamagui";

export function TreeWidget() {
	const router = useRouter();

	return (
		<XStack width="100%" justify="center">
			<Card
				width="100%"
				maxWidth={500}
				size="$4"
				borderWidth={1}
				borderColor="$borderColor"
			>
				<Card.Header p="$4">
					<H2>あなたの木</H2>
				</Card.Header>
				<Card.Footer p="$4">
					<XStack flex={1} />
					<Button rounded="$10" onPress={() => router.push("/books")}>
						詳細を見る
					</Button>
				</Card.Footer>
				<Card.Background items="center">
					<ProgressTree />
				</Card.Background>
			</Card>
		</XStack>
	);
}
