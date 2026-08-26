import { Plus } from "@tamagui/lucide-icons-2/icons/Plus";
import { Button, Card, Image, XStack } from "tamagui";

export function BookWidget() {
	return (
		<Card
			width="100%"
			maxWidth={500}
			borderWidth={1}
			borderColor="$borderColor"
		>
			<XStack p="$3" gap="$3" items="center">
				<Button rounded="$10" icon={Plus} circular size="$6" />
				<Image
					src="https://placehold.co/200x280/png"
					width={100}
					height={140}
					objectFit="cover"
					rounded="$3"
				/>
				<Image
					src="https://placehold.co/200x280/png"
					width={100}
					height={140}
					objectFit="cover"
					rounded="$3"
				/>
			</XStack>
		</Card>
	);
}
