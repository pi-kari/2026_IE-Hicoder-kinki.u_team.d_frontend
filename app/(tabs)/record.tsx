import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import { ChevronDown } from "@tamagui/lucide-icons-2/icons/ChevronDown";
import { Toaster, toast } from "@tamagui/toast/v2";
import { useAuth } from "context/AuthContext";
import { getItem } from "context/sessionStorage";
import { fetch } from "expo/fetch";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
	BookResponseSchema,
	ProgressUpdateResponseSchema,
} from "schemas/openapi";
import {
	Button,
	Card,
	H3,
	Input,
	Select,
	Strong,
	TextArea,
	XStack,
	YStack,
} from "tamagui";

export default function TabTwoScreen() {
	const router = useRouter();
	const { userId, isLoading } = useAuth();

	// 本の一覧
	const [books, setBooks] = useState<{ id: number; title: string }[]>([
		{ id: 1, title: "apple" },
		{ id: 2, title: "banana" },
		{ id: 3, title: "cherry" },
	]);

	// 選択された本のIDと、入力されたページ数を保持するステートを追加
	const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
	const [pagesRead, setPagesRead] = useState<string>("");

	useEffect(() => {
		if (isLoading || userId === null) {
			return;
		}

		// // 例としての初期データ
		// setBooks([
		// 	{ id: 1, title: "apple" },
		// 	{ id: 2, title: "banana" },
		// 	{ id: 3, title: "cherry" },
		// ]);

		const fetchBooks = async () => {
			try {
				const response = await fetch(
					`${process.env.EXPO_PUBLIC_BACKEND_URL}/users/${userId}/books`,
				)
					.then((res) => res.json())
					.then((res) => BookResponseSchema.array().parse(res));

				if (response.length === 0) {
					router.push("/books-information");
				}

				setBooks(
					response.map((book) => ({
						id: book.book_id,
						title: book.book_title,
					})),
				);

				const storedBookIds = await getItem("registered_book_ids");
				const registeredBookIds: number[] = storedBookIds
					? JSON.parse(storedBookIds)
					: [];
				const lastRegisteredBookId = registeredBookIds.at(-1);
				if (lastRegisteredBookId !== undefined) {
					setSelectedBookId(lastRegisteredBookId);
				}
			} catch (error) {
				console.error("Failed to fetch books:", error);
			}
		};
		fetchBooks();
	}, [isLoading, userId, router]);

	// 登録ボタンが押されたときの送信処理
	const submitProgress = async () => {
		if (selectedBookId === null) {
			toast.error("本を選択してください");
			return;
		}

		if (
			!pagesRead ||
			Number.isNaN(Number(pagesRead)) ||
			Number(pagesRead) <= 0
		) {
			toast.error("有効なページ数を入力してください");
			return;
		}

		// サーバーへPOSTリクエストを送信
		const response = await fetch(
			`${process.env.EXPO_PUBLIC_BACKEND_URL}/users/${userId}/books/${selectedBookId}/progress`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					pages_read: Number(pagesRead),
				}),
			},
		)
			.then((res) => res.json())
			.then((res) => ProgressUpdateResponseSchema.parse(res));

		toast.success(`進捗を登録しました: ${response.total_progress}`);
	};

	return (
		<YStack flex={1} items="center" gap="$6" px="$5" pt="$6" bg="$background">
			<Toaster position="bottom-right" />
			<Card
				width="100%"
				maxWidth={700}
				size="$4"
				borderWidth={1}
				borderColor="$borderColor"
				p="$3"
			>
				<Card.Header p="$4" gap="$1">
					<H3>進捗を記録</H3>
					<XStack items="center" gap="$2" width="100%" pt="$3">
						<Select
							value={selectedBookId === null ? "" : String(selectedBookId)}
							onValueChange={(val: string) => setSelectedBookId(Number(val))}
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
											<Select.Item
												key={book.id}
												index={index}
												value={book.id.toString()}
											>
												<Select.ItemText>{book.title}</Select.ItemText>
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
				<Strong>メモ</Strong>
				<TextArea borderWidth={2} />
			</Card>
		</YStack>
	);
}
