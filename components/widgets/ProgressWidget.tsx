import { useAuth } from "context/AuthContext";
import { fetch } from "expo/fetch";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { BookResponseSchema } from "schemas/openapi";
import { Button, Card, H2, Paragraph, Progress, XStack, YStack } from "tamagui";
import type z from "zod";

export function ProgressWidget() {
	const { userId } = useAuth();
	const [books, setBooks] = useState<z.infer<typeof BookResponseSchema>[]>([]);

	useEffect(() => {
		// セッション復元前 / 未ログインのときは叩かない
		if (!userId) return;

		const fetchProgress = async () => {
			try {
				const response = await fetch(
					`${process.env.EXPO_PUBLIC_BACKEND_URL}/users/${userId}/books/`,
				)
					.then((res) => res.json())
					.then((res) => BookResponseSchema.array().parse(res));
				setBooks(response);
			} catch (error) {
				console.error("Failed to fetch progress:", error);
			}
		};
		fetchProgress();
	}, [userId]);

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
					{books.slice(-5).map((book) => (
						<YStack key={book.book_id} gap="$1">
<<<<<<< Updated upstream
							<XStack items="center" gap="$2">
								<Paragraph flex={1} numberOfLines={1}>
									{book.book_title}
								</Paragraph>
								<Paragraph size="$2" color="$gray10">
									{book.book_pages > 0
										? `${book.total_progress} / ${book.book_pages} ページ (${book.tree_ratio}%)`
										: `${book.total_progress} ページ`}
								</Paragraph>
							</XStack>
							{/* **tree_ratio を渡す。** total_progress は到達ページ番号なので、
							    max={100} と組み合わせると 100 ページを超えた本がすべて
							    満タンに見えてしまう (300 ページの本を 104 ページまで
							    読んだら 104/100 で頭打ち)。割合は domain/tree.ts が
							    ページ数で割って 0〜100 にクランプ済み。 */}
=======
							<Paragraph>{book.book_title}</Paragraph>
>>>>>>> Stashed changes
							<Progress value={book.tree_ratio} max={100} height="$1.5">
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
