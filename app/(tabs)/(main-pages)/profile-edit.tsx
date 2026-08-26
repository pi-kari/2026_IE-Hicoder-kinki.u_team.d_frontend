import { Plus } from "@tamagui/lucide-icons-2";
import { Link } from "expo-router";
import {
	Button,
	Card,
	H2,
	H3,
	Image,
	Paragraph,
	Text,
	XStack,
	YStack,
} from "tamagui";

const books = [
	{ id: "1", imageUrl: "https://placehold.co/200x280/png?text=1" },
	{ id: "2", imageUrl: "https://placehold.co/200x280/png?text=2" },
	{ id: "3", imageUrl: "https://placehold.co/200x280/png?text=3" },
];

export default function ProfScreen() {
	return (
		<YStack flex={1} p="$4" items="center" justify="center" gap="$4">
			<Card
				width="100%"
				maxWidth={500}
				borderWidth={1}
				borderColor="$borderColor"
			>
				<XStack p="$3" gap="$3">
					<Image
						src="https://placehold.co/200x280/png"
						width={100}
						height={140}
						objectFit="cover"
						rounded="$3"
					/>

					<YStack flex={1} gap="$2">
						<H3 fontSize={18}>おすすめの本</H3>

						<Paragraph color="$gray11">感想文とか？</Paragraph>

						<Text color="$gray10" fontSize={12}>
							ニックネーム: Hicoder
						</Text>
					</YStack>
				</XStack>
			</Card>

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
			<Card
				width="100%"
				maxWidth={500}
				borderWidth={1}
				borderColor="$borderColor"
			>
				<Card.Header p="$4">
					<H2>あなたの木</H2>
					<Paragraph>（成長段階とか書いてみる？）</Paragraph>
				</Card.Header>
				<Card.Footer p="$4">
					<XStack flex={1} />
					<Link href="/books" asChild>
						<Button rounded="$10">詳細を見る</Button>
					</Link>
				</Card.Footer>
				<Card.Background items="center">
					<Image
						objectFit="contain"
						width={256}
						height={256}
						src="https://placehold.co/256x256/png?text=TREE"
					></Image>
				</Card.Background>
			</Card>
		</YStack>
	);
}
