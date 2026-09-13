import { useAuth } from "context/AuthContext";
import { getItem } from "context/sessionStorage";
import { Link } from "expo-router";
import { Button, Card, H2, XStack } from "tamagui";
import { useEffect, useState } from "react";
import { Image, type ImageSourcePropType } from "react-native";
import { ResponseTreeStateSchema } from "schemas/openapi";
import type z from "zod";

const TREE_IMAGES: Record<number, ImageSourcePropType> = {
	1: require("../../assets/images/tree_1.png"),
	2: require("../../assets/images/tree_2.png"),
	3: require("../../assets/images/tree_3.png"),
};

export function TreeWidget() {
	const { userId } = useAuth();
	const [treeState, setTreeState] = useState<
		z.infer<typeof ResponseTreeStateSchema> | null
	>(null);

	useEffect(() => {
		if (!userId) return;

		const fetchTreeState = async () => {
			try {
				const storedBookIds = await getItem("registered_book_ids");
				const registeredBookIds: number[] = storedBookIds
					? JSON.parse(storedBookIds)
					: [];
				const latestBookId = registeredBookIds.at(-1);

				if (latestBookId === undefined) {
					setTreeState(null);
					return;
				}

				const response = await fetch(
					`${process.env.EXPO_PUBLIC_BACKEND_URL}/users/${userId}/books/${latestBookId}/tree/`,
				);
				const data = await response.json();
				const parsed = Array.isArray(data)
					? ResponseTreeStateSchema.array().parse(data)
					: [ResponseTreeStateSchema.parse(data)];
				setTreeState(parsed.at(-1) ?? parsed[0] ?? null);
			} catch (error) {
				console.error("Failed to fetch tree state:", error);
			}
		};

		fetchTreeState();
	}, [userId]);

	const treeLevel = treeState?.tree_state ?? 1;
	const currentTreeImage = TREE_IMAGES[treeLevel] ?? TREE_IMAGES[1];

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
					<Link href="/books" asChild>
						<Button rounded="$10">詳細を見る</Button>
					</Link>
				</Card.Footer>
				<Card.Background items="center">
					<Image
						source={currentTreeImage}
						style={{ width: 150, height: 200, borderRadius: 8 }}
					/>
				</Card.Background>
			</Card>
		</XStack>
	);
}
