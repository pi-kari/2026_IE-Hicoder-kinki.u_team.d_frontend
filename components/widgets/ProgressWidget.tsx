import { Link } from "expo-router";
import { Button, Card, H2, Paragraph, Progress, XStack, YStack } from "tamagui";

const progressItems = [
	{ label: "一冊目のタイトル", value: 80, visible: true },
	{ label: "二冊目のタイトル", value: 60, visible: true },
	{ label: "三冊目のタイトル", value: 40, visible: true },
];

export function ProgressWidget() {
	return (
		<Card
			width="100%"
			maxWidth={500}
			size="$4"
			borderWidth={1}
			borderColor="$borderColor"
		>
			<Card.Header p="$4">
				<H2>進捗状況</H2>
			</Card.Header>
			<YStack px="$4" pb="$4">
				<YStack gap="$3">
					{progressItems
						.filter((item) => item.visible)
						.map((item) => (
							<YStack key={item.label} gap="$1">
								<Paragraph>{item.label}</Paragraph>
								<Progress value={item.value} max={100} height="$1.5">
									<Progress.Indicator background="$green10" />
								</Progress>
							</YStack>
						))}
				</YStack>
			</YStack>
			<Card.Footer p="$4">
				<XStack flex={1} />
				<Link href="/books-information" asChild>
					<Button rounded="$10">詳細を見る</Button>
				</Link>
			</Card.Footer>
		</Card>
	);
}
