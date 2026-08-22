import { Link } from "expo-router";
import { Button, Card, H2, Image, Paragraph, XStack } from "tamagui";

export function TreeWidget() {
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
					<Paragraph>（成長段階とか書いてみる？）</Paragraph>
				</Card.Header>
				<Card.Footer p="$4">
					<XStack flex={1} />
					<Link href="/books-list" asChild>
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
		</XStack>
	);
}
