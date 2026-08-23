import { Plus } from "@tamagui/lucide-icons-2";
import { ProfileWidget } from "components/widgets/ProfileWidget";
import { TreeWidget } from "components/widgets/TreeWidget";
import { Button, Card, Image, XStack, YStack } from "tamagui";

const books = [
	{ id: "1", imageUrl: "https://placehold.co/200x280/png?text=1" },
	{ id: "2", imageUrl: "https://placehold.co/200x280/png?text=2" },
	{ id: "3", imageUrl: "https://placehold.co/200x280/png?text=3" },
];

export default function ProfScreen() {
	return (
		<YStack flex={1} p="$4" items="center" justify="center" gap="$4">
			<ProfileWidget />
			<Card
				width="100%"
				maxWidth={500}
				borderWidth={1}
				borderColor="$borderColor"
			>
				<XStack p="$3" gap="$3" items="center">
					{books.slice(0, 3).map((book) => (
						<Image
							key={book.id}
							src={book.imageUrl}
							width={65}
							height={90}
							objectFit="cover"
							rounded="$2"
						/>
					))}

					<Button size="$4" circular icon={Plus} />
				</XStack>
			</Card>
			<TreeWidget />
		</YStack>
	);
}
