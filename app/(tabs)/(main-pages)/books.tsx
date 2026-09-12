import { useAuth } from "context/AuthContext";
import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, useWindowDimensions } from "react-native";
import { BookResponseSchema } from "schemas/openapi";
import { Button, Card, H3, Image, Paragraph, XStack, YStack } from "tamagui";
import type z from "zod";

// const PAGE_SIZE = 24;
const GRID_COLUMNS = 3;
const HORIZONTAL_PADDING = 16;
const GRID_GAP = 12;

/**
// 仮データ用。DB実装後は不要
const MOCK_BOOK_COUNT = 100;



async function fetchBooksPage(page: number, pageSize: number): Promise<z.infer<typeof BookResponseSchema>[]> {
	// DBから情報持ってくるのに書き換えてください。今はカスの仮実装をおいてます。
	const start = (page - 1) * pageSize;
	const count = Math.min(pageSize, MOCK_BOOK_COUNT - start);

	if (count <= 0) {
		return [];
	}

	return Array.from({ length: count }, (_, index) => {
		const no = start + index + 1;

		return {
			id: String(no),
			title: `書籍タイトル ${no}`,
			coverImageUrl: `https://hogehoge.hogehoge/no${no}.jpg`,
		};
	});
}
*/

export default function BooksListScreen() {
	const { userId } = useAuth();

	const [books, setBooks] = useState<z.infer<typeof BookResponseSchema>[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	/**
    const [hasMore, setHasMore] = useState(true);

	const pageRef = useRef(1);
	const loadingRef = useRef(false);
    */

	const { width } = useWindowDimensions();

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

	const cardWidth = Math.max(
		96,
		(width - HORIZONTAL_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) /
			GRID_COLUMNS,
	);

	/**
	const loadMore = useCallback(async () => {
		if (loadingRef.current || !hasMore) {
			return;
		}

		loadingRef.current = true;
		setIsLoading(true);

		const targetPage = pageRef.current;

		try {
			const rows = await fetchBooksPage(targetPage, PAGE_SIZE);
			setBooks((prev) => (targetPage === 1 ? rows : [...prev, ...rows]));

			if (rows.length < PAGE_SIZE) {
				setHasMore(false);
			} else {
				pageRef.current++;
			}
		} catch (error) {
			console.error("書籍データの取得に失敗しました:", error);
		} finally {
			loadingRef.current = false;
			setIsLoading(false);
		}
	}, [hasMore]);

	useEffect(() => {
		void loadMore();
	}, [loadMore]);
    */

	const renderItem = useCallback(
		({ item }: { item: z.infer<typeof BookResponseSchema> }) => (
			<Card
				width={cardWidth}
				size="$3"
				borderWidth={1}
				borderColor="$borderColor"
			>
				<Card.Header p="$2">
					<H3 numberOfLines={2} fontSize={14} lineHeight={18}>
						{item.book_title}
					</H3>
				</Card.Header>

				<YStack px="$2" pb="$2" items="center">
					<Image
						src={`https://placehold.co/200x280/png?text=${item.book_id}`}
						objectFit="cover"
						width={cardWidth - 16}
						height={(cardWidth - 16) * 1.4}
						borderRadius={8}
					/>
				</YStack>

				<Card.Footer p="$2">
					<XStack flex={1} />

						<Link
							href={{
								pathname: "/books-information",
								params: {
									bookId: item.book_id,
								},
							}}
							asChild
						>
							<Button size="$2" style={{ borderRadius: 8 }}>
								詳細
							</Button>
						</Link>
				</Card.Footer>
			</Card>
		),
		[cardWidth],
	);

	return (
		<YStack flex={1} bg="$background">
			<FlatList
				data={books}
				keyExtractor={(item) => item.book_id.toString()}
				renderItem={renderItem}
				numColumns={GRID_COLUMNS}
				contentContainerStyle={{
					paddingHorizontal: HORIZONTAL_PADDING,
					paddingVertical: 16,
				}}
				columnWrapperStyle={{
					gap: GRID_GAP,
					marginBottom: GRID_GAP,
				}}
				// onEndReached={loadMore}
				// onEndReachedThreshold={0.4}
				ListEmptyComponent={
					!isLoading ? (
						<YStack py="$10" items="center" width="100%">
							<Paragraph color="$gray10">
								表示できる書籍データがありません
							</Paragraph>
						</YStack>
					) : null
				}
				ListFooterComponent={
					isLoading ? (
						<YStack py="$4" items="center">
							<ActivityIndicator />
						</YStack>
					) : null
				}
			/>
		</YStack>
	);
}
