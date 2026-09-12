"use client";

import { useAuth } from "context/AuthContext";
import { getJson } from "lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookResponseSchema } from "schemas/openapi";
import { Button, Card, H2, Paragraph, Progress, XStack, YStack } from "tamagui";
import type z from "zod";

export function ProgressWidget() {
	const { userId } = useAuth();
	const router = useRouter();
	const [books, setBooks] = useState<z.infer<typeof BookResponseSchema>[]>([]);

	useEffect(() => {
		// セッション復元前 / 未ログインのときは叩かない
		if (!userId) return;

		const fetchProgress = async () => {
			try {
				const response = await getJson(
					`/users/${userId}/books`,
					BookResponseSchema.array(),
				);
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
							<Paragraph>{book.book_title}</Paragraph>
							<Progress value={book.total_progress} max={100} height="$1.5">
								<Progress.Indicator background="$green10" />
							</Progress>
						</YStack>
					))}
				</YStack>
			</YStack>
			<Card.Footer p="$4">
				<XStack flex={1} />
				<Button rounded="$10" onPress={() => router.push("/books-information")}>
					詳細を見る
				</Button>
			</Card.Footer>
		</Card>
	);
}
