"use client";

import { PageHeader } from "components/PageHeader";
import { useBookCovers } from "components/useBookCovers";
import { useAuth } from "context/AuthContext";
import { useLocalDb } from "context/LocalDbContext";
import { listBooks } from "lib/local/repo";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { BookResponseSchema } from "schemas/openapi";
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
	const { ready } = useLocalDb();
	const router = useRouter();

	const [books, setBooks] = useState<z.infer<typeof BookResponseSchema>[]>([]);
	// ISBN から取り込んだ表紙があれば使う (無ければプレースホルダ)。
	const coverOf = useBookCovers(books);
	// NOTE: Expo 版から引き継いだ状態。セットする経路はコメントアウトされた
	// ページング実装にしか無かったので、常に false のまま。空表示の出し分けにだけ使う。
	const [isLoading] = useState(false);

	useEffect(() => {
		// セッション復元前 / 未ログイン / DB 未準備のときは叩かない
		if (!userId || !ready) return;

		const fetchProgress = async () => {
			try {
				setBooks(await listBooks(userId));
			} catch (error) {
				console.error("進捗の取得に失敗しました:", error);
			}
		};

		fetchProgress();
	}, [userId, ready]);

	return (
		<YStack flex={1} bg="$background">
			<PageHeader title="書籍一覧" />

			<XStack
				gap="$3"
				px="$4"
				py="$4"
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
				}}
			>
				{books.map((book) => (
					<Card
						key={book.book_id}
						minW={0}
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
								src={coverOf(book)}
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
