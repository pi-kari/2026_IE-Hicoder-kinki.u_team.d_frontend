"use client";

import { PageHeader } from "components/PageHeader";
import { useAuth } from "context/AuthContext";
import { getJson } from "lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookResponseSchema } from "schemas/openapi";
import {
	Button,
	Card,
	H3,
	Image,
	Paragraph,
	Spinner,
	XStack,
	YStack,
} from "tamagui";
import type z from "zod";

export default function BooksPage() {
	const { userId } = useAuth();
	const router = useRouter();

	const [books, setBooks] = useState<z.infer<typeof BookResponseSchema>[]>([]);
	// NOTE: Expo 版から引き継いだ状態。セットする経路はコメントアウトされた
	// ページング実装にしか無かったので、常に false のまま。空表示の出し分けにだけ使う。
	const [isLoading] = useState(false);

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
				console.error("進捗の取得に失敗しました:", error);
			}
		};

		fetchProgress();
	}, [userId]);

	return (
		<YStack flex={1} bg="$background">
			<PageHeader title="書籍一覧" />

			{/*
			 * 旧版は FlatList の numColumns={3} と useWindowDimensions からの
			 * cardWidth 計算で 3 列を作っていた。web では CSS に任せれば済むので
			 * 幅の計算ごと削除し、flexWrap で折り返す。
			 */}
			<XStack flexWrap="wrap" gap="$3" px="$4" py="$4">
				{books.map((book) => (
					<Card
						key={book.book_id}
						flexBasis="30%"
						flexGrow={1}
						minW={96}
						size="$3"
						borderWidth={1}
						borderColor="$borderColor"
					>
						<Card.Header p="$2">
							<H3 fontSize={14} lineHeight={18}>
								{book.book_title}
							</H3>
						</Card.Header>

						<YStack px="$2" pb="$2" items="center">
							<Image
								src={`https://placehold.co/200x280/png?text=${book.book_id}`}
								objectFit="cover"
								width="100%"
								aspectRatio={1 / 1.4}
								borderRadius={8}
							/>
						</YStack>

						<Card.Footer p="$2">
							<XStack flex={1} />
							<Button
								size="$2"
								rounded="$8"
								onPress={() =>
									router.push(`/books-information?bookId=${book.book_id}`)
								}
							>
								詳細
							</Button>
						</Card.Footer>
					</Card>
				))}
			</XStack>

			{!isLoading && books.length === 0 ? (
				<YStack py="$10" items="center" width="100%">
					<Paragraph color="$gray10">
						表示できる書籍データがありません
					</Paragraph>
				</YStack>
			) : null}

			{isLoading ? (
				<YStack py="$4" items="center">
					<Spinner />
				</YStack>
			) : null}
		</YStack>
	);
}
