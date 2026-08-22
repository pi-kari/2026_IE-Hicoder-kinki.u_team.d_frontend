import { Check, ChevronDown } from "@tamagui/lucide-icons-2";
import { fetch } from "expo/fetch";
import { useEffect, useState } from "react";
import { Button, Card, H3, Input, Select, XStack, YStack } from "tamagui";

export default function TabTwoScreen() {
	// 本の一覧
	const [books, setBooks] = useState<string[]>(["apple", "banana", "cherry"]);

	// 選択された本のIDと、入力されたページ数を保持するステートを追加
	const [selectedBookId, setSelectedBookId] = useState<string>("");
	const [pagesRead, setPagesRead] = useState<string>("");

	useEffect(() => {
		// 例としての初期データ
		setBooks(["apple", "banana", "cherry"]);

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
				pagesRead: Number(pagesRead),
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
						<Select
							value={selectedBookId}
							onValueChange={(val: string) => setSelectedBookId(val)}
						>
							<Select.Trigger
								width={160}
								iconAfter={ChevronDown}
								rounded={"$3"}
							>
								<Select.Value placeholder="書籍を選択" />
							</Select.Trigger>

							<Select.Content>
								<Select.Viewport>
									<Select.Group>
										{books.map((book, index) => (
											<Select.Item key={book} index={index} value={book}>
												<Select.ItemText>{book}</Select.ItemText>
												<Select.ItemIndicator>
													<Check size={16} />
												</Select.ItemIndicator>
											</Select.Item>
										))}
									</Select.Group>
								</Select.Viewport>
							</Select.Content>
						</Select>

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
