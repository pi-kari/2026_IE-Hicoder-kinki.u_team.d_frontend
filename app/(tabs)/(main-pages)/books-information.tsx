import { Plus } from "@tamagui/lucide-icons-2/icons/Plus";
import { useAuth } from "context/AuthContext";
import { getItem, setItem } from "context/sessionStorage";
import { fetch } from "expo/fetch";
import { useState } from "react";
import { BookResponseSchema } from "schemas/openapi";
import { Button, Card, H3, Input, XStack, YStack } from "tamagui";

export default function BooksInformationScreen() {
	const [selectedBook, setSelectedBook] = useState<string>("");
	const { userId } = useAuth();
	const [book_pages, setBookPages] = useState<number | null>(null);

	const submitProgress = async () => {
		// サーバーへPOSTリクエストを送信
		const response = await fetch(
			`${process.env.EXPO_PUBLIC_BACKEND_URL}/users/${userId}/books`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					book_title: selectedBook,
					status: "string",
					book_pages: book_pages,
				}),
			},
		)
			.then((res) => res.json())
			.then((res) => BookResponseSchema.parse(res));

		const storedBookIds = await getItem("registered_book_ids");
		const registeredBookIds: number[] = storedBookIds
			? JSON.parse(storedBookIds)
			: [];
		if (!registeredBookIds.includes(response.book_id)) {
			registeredBookIds.push(response.book_id);
		}
		await setItem("registered_book_ids", JSON.stringify(registeredBookIds));

		// toast.success(`書籍を登録しました: ${response.book_id}`);
	};

	return (
		<YStack flex={1} items="center" gap="$6" px="$5" pt="$6" bg="$background">
			<Card
				width="100%"
				maxWidth={500}
				size="$4"
				borderWidth={1}
				borderColor="$borderColor"
			>
				<Card.Header p="$4" gap="$1">
					<H3>書籍情報を登録</H3>
					<XStack items="center" gap="$2" width="100%" pt="$3">
						<Button icon={Plus} iconSize="$4" size="$5">
							写真を追加
						</Button>
						<Input
							value={selectedBook}
							onChangeText={setSelectedBook}
							theme="surface1"
							flex={1}
							size="$5"
							placeholder="本のタイトルを入力"
						/>
						<Input
							value={book_pages !== null ? book_pages.toString() : ""}
							onChangeText={(text) => setBookPages(Number(text))}
							theme="surface1"
							flex={1}
							size="$5"
							placeholder="ページ数を入力"
							keyboardType="numeric"
						/>
						<Button size="$5" onClick={submitProgress}>
							登録
						</Button>
					</XStack>
				</Card.Header>
			</Card>
		</YStack>
	);
}
