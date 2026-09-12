import {
	Avatar,
	Card,
	H3,
	Paragraph,
	Strong,
	Text,
	XStack,
	YStack,
} from "tamagui";

export function ProfileWidget() {
	return (
		<Card
			width="100%"
			maxWidth={500}
			borderWidth={1}
			borderColor="$borderColor"
		>
			<XStack p="$3" gap="$3">
				<YStack flex={1} gap="$2" items="center" justify="center">
					<Avatar circular size="$6">
						<Avatar.Image src="http://picsum.photos/200/301" />
					</Avatar>
					<Paragraph fontSize={12}>
						<Strong>Name</Strong>
					</Paragraph>
				</YStack>
				<YStack flex={1} gap="$2">
					<H3 fontSize={18}>おすすめの本</H3>

					<Paragraph color="$gray11">感想文とか？</Paragraph>

					<Text color="$gray10" fontSize={12}>
						ニックネーム: Hicoder
					</Text>
				</YStack>
			</XStack>
		</Card>
	);
}
