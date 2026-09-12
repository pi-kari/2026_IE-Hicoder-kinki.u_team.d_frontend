"use client";

import { Plus } from "@tamagui/lucide-icons-2/icons/Plus";
import { PageHeader } from "components/PageHeader";
import { useAuth } from "context/AuthContext";
import { getItem, setItem } from "context/sessionStorage";
import { sendJson } from "lib/api";
import { useState } from "react";
import { BookResponseSchema } from "schemas/openapi";
import { Button, Card, H3, Input, XStack, YStack } from "tamagui";

export default function BooksInformationPage() {
	const [selectedBook, setSelectedBook] = useState<string>("");
	const { userId } = useAuth();
	const [book_pages, setBookPages] = useState<number | null>(null);

	const submitProgress = async () => {
		// サーバーへPUTリクエストを送信
		// NOTE: status は API 側で無視され常に "積読" になる。サーバだけ直すと
		// この "string" が全レコードを汚染するので、UI に状態選択を足すまで据え置く。
		const response = await sendJson(
			"PUT",
			`/users/${userId}/books`,
			{
				book_title: selectedBook,
				status: "string",
				book_pages: book_pages,
			},
			BookResponseSchema,
		);

		const storedBookIds = await getItem("registered_book_ids");
		const registeredBookIds: number[] = storedBookIds
			? JSON.parse(storedBookIds)
			: [];
		if (!registeredBookIds.includes(response.book_id)) {
			registeredBookIds.push(response.book_id);
		}
		await setItem("registered_book_ids", JSON.stringify(registeredBookIds));
	};

	return (
		<YStack flex={1} bg="$background">
			<PageHeader title="書籍情報を登録" />
			<YStack flex={1} items="center" gap="$6" px="$5" pt="$6">
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
								inputMode="numeric"
							/>
							<Button size="$5" onPress={submitProgress}>
								登録
							</Button>
						</XStack>
					</Card.Header>
				</Card>
			</YStack>
		</YStack>
	);
}
