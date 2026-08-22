import { BookSelect, type SelectItem } from "components/BookSelect";
import { fetch } from "expo/fetch";
import { useEffect, useState } from "react";
import { Button, Card, H3, Input, XStack, YStack } from "tamagui";

export default function TabTwoScreen() {
	// 本の一覧
	const [books, setBooks] = useState<SelectItem[]>([]);

	// 選択された本のIDと、入力されたページ数を保持するステートを追加
	const [selectedBookId, setSelectedBookId] = useState<string>("");
	const [pagesRead, setPagesRead] = useState<string>("");

	useEffect(() => {
		// 例としての初期データ
		setBooks([{ name: "apple" }, { name: "banana" }]);

		const fetchBooks = async () => {
			try {
				const response = await fetch(
					"https://jsonplaceholder.typicode.com/posts/1",
				);
				const json = await response.json();
				// 必要に応じてここで setBooks を行う
			} catch (error) {
				console.error("Failed to fetch books:", error);
			}
		};
		fetchBooks();
	}, []);

	// 登録ボタンが押されたときの送信処理
	const submitProgress = async () => {
		if (!selectedBookId) {
			alert("本を選択してください");
			return;
		}

		// サーバーへPOSTリクエストを送信
		const response = await fetch("https://jsonplaceholder.typicode.com/posts", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				bookId: selectedBookId,
				pagesRead: Number(pagesRead), // 数値に変換
			}),
		});

		const data = await response.json();
	};

	return (
		<YStack flex={1} items="center" gap="$6" px="$5" pt="$6" bg="$background">
			<Card
				width="100%"
				maxWidth={700}
				size="$4"
				borderWidth={1}
				borderColor="$borderColor"
			>
				<Card.Header p="$4" gap="$1">
					<H3>進捗を記録</H3>
					<XStack items="center" gap="$2" width="100%" pt="$3">
						{/* ▼ 3. BookSelect に選択状態と変更時のハンドラーを繋ぐ */}
						<BookSelect
							items={books}
							size="$5"
							value={selectedBookId}
							onValueChange={(val: string) => setSelectedBookId(val)}
						>
							書籍を選択
						</BookSelect>
						<Input
							theme="surface1"
							flex={1}
							size="$5"
							placeholder="今回読んだページ数を入力"
							keyboardType="numeric"
							value={pagesRead}
							onChangeText={(text) => setPagesRead(text)}
						/>
						<Button size="$5" onPress={submitProgress}>
							登録
						</Button>
					</XStack>
				</Card.Header>
			</Card>
		</YStack>
	);
}
