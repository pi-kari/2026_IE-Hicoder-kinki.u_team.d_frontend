"use client";

import { Anchor, Paragraph, View, XStack } from "tamagui";

export default function ModalPage() {
	return (
		<View flex={1} minH="100vh" items="center" justify="center">
			<XStack gap="$2">
				<Paragraph text="center">Made by</Paragraph>
				<Anchor
					color="$blue10"
					href="https://twitter.com/natebirdman"
					target="_blank"
				>
					@natebirdman,
				</Anchor>
				<Anchor
					color="$color12"
					href="https://github.com/tamagui/tamagui"
					target="_blank"
					rel="noreferrer"
				>
					give it a ⭐️
				</Anchor>
			</XStack>
		</View>
	);
}
