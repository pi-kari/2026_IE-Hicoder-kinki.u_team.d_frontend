import { Plus } from "@tamagui/lucide-icons-2/icons/Plus";
import { ProfileWidget } from "components/widgets/ProfileWidget";
import { TreeWidget } from "components/widgets/TreeWidget";
import { useAuth } from "context/AuthContext";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { BookResponseSchema } from "schemas/openapi";
import { Button, Card, Image, XStack, YStack } from "tamagui";
import type z from "zod";

export default function ProfScreen() {
	const { userId } = useAuth();
	const [books, setBooks] = useState<z.infer<typeof BookResponseSchema>[]>([]);

	useEffect(() => {
		// セッション復元前 / 未ログインのときは叩かない
		if (!userId) return;

		const fetchProgress = async () => {
			try {
				const response = await fetch(
					`${process.env.EXPO_PUBLIC_BACKEND_URL}/users/${userId}/books`,
				)
					.then((res) => res.json())
					.then((res) => BookResponseSchema.array().parse(res));

				setBooks(response);
			} catch (error) {
				console.error("進捗の取得に失敗しました:", error);
			}
		};

		fetchProgress();
	}, [userId]);

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
					{books.slice(-3).map((book) => (
						<Image
							key={book.book_id}
							src={`https://placehold.co/200x280/png?text=${book.book_id}`}
							width={65}
							height={90}
							objectFit="cover"
							rounded="$2"
						/>
					))}

					<Link href="/(tabs)/(main-pages)/books-information" asChild>
						<Button size="$4" circular icon={Plus} />
					</Link>
				</XStack>
			</Card>
			<TreeWidget />
		</YStack>
	);
}
