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
	Label,
	Paragraph,
	Select,
	TextArea,
	YStack,
} from "tamagui";

<<<<<<< Updated upstream:app/(tabs)/record/page.tsx
type BookChoice = { id: string; title: string; pages: number };

export default function RecordPage() {
=======
export default function TabTwoScreen() {
>>>>>>> Stashed changes:app/(tabs)/record.tsx
	const router = useRouter();
	const { userId, isLoading } = useAuth();

<<<<<<< Updated upstream:app/(tabs)/record/page.tsx
	// 本の一覧。book_id は uuid なので string。
	const [books, setBooks] = useState<BookChoice[]>([]);

	const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
	// 「そのとき読み終わったページ番号」。読んだページ数ではない。
	const [pageReached, setPageReached] = useState<string>("");
=======
	// 本の一覧
	const [books, setBooks] = useState<{ id: number; title: string }[]>([
		{ id: 1, title: "apple" },
		{ id: 2, title: "banana" },
		{ id: 3, title: "cherry" },
	]);

	// 選択された本のIDと、入力されたページ数を保持するステートを追加
	const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
	const [pagesRead, setPagesRead] = useState<string>("");
>>>>>>> Stashed changes:app/(tabs)/record.tsx

	useEffect(() => {
		if (isLoading || userId === null) {
			return;
		}

		// 例としての初期データ
		setBooks([
			{ id: 1, title: "apple" },
			{ id: 2, title: "banana" },
			{ id: 3, title: "cherry" },
		]);

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

<<<<<<< Updated upstream:app/(tabs)/record/page.tsx
				const list = response.map((book) => ({
					id: book.book_id,
					title: book.book_title,
					pages: book.book_pages,
				}));
				setBooks(list);
=======
				setBooks(
					response.map((book) => ({
						id: book.book_id,
						title: book.book_title,
					})),
				);
>>>>>>> Stashed changes:app/(tabs)/record.tsx

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

	const selected = books.find((b) => b.id === selectedBookId) ?? null;

	// 登録ボタンが押されたときの送信処理
	const submitProgress = async () => {
		if (selectedBookId === null) {
			toast.error("本を選択してください");
			return;
		}

		const page = Number(pageReached);
		if (!pageReached || Number.isNaN(page) || page <= 0) {
			toast.error("ページ番号を入力してください");
			return;
		}
		// ページ数が入っていない本は上限を決められない。**素通りさせない。**
		// 素通りさせると何ページでも記録でき、進捗率も出せないままになる
		// (以前 0 ページの本を作れたときに実際そうなっていた)。
		if (selected && selected.pages < 1) {
			toast.error("この本はページ数が未設定です。書籍情報を直してください");
			return;
		}
		// 104 のつもりで 1040 と打つ間違いを拾う。
		if (selected && page > selected.pages) {
			toast.error(`この本は ${selected.pages} ページまでです`);
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

<<<<<<< Updated upstream:app/(tabs)/record/page.tsx
		// 端末内 DB に直接書く。オフラインでもここまでは必ず成功する。
		//
		// HTTP を経由しなくなったので失敗はステータスではなく例外で来る。
		// 以前はここに try/catch が無く、500 のときレスポンスの JSON パースで
		// unhandled rejection になってユーザーには何も出なかった。
		try {
			const response = await recordProgress(userId, selectedBookId, page);
			// 到達位置は MAX で導出するので、読み返して小さい番号を入れたときは
			// 入力値ではなく実際の到達位置が返る。返ってきた値を見せる。
			toast.success(
				`進捗を登録しました: ${response.total_progress} ページまで`,
			);
			setPageReached("");
		} catch (error) {
			console.error(error);
			toast.error("記録に失敗しました");
		}
=======
		toast.success(`進捗を登録しました: ${response.total_progress}`);
>>>>>>> Stashed changes:app/(tabs)/record.tsx
	};

	return (
		<YStack flex={1} items="center" gap="$6" px="$4" pt="$6" bg="$background">
			<Toaster position="bottom-right" />
			<Card
				width="100%"
				maxWidth={560}
				size="$4"
				borderWidth={1}
				borderColor="$borderColor"
			>
				{/* 以前は 1 行の XStack に詰めていて、入力欄が狭く文字が読めなかった。
				    縦に積んで 1 つずつ全幅にしている。 */}
				<YStack p="$4" gap="$4">
					<H3>進捗を記録</H3>

					<YStack gap="$2">
						<Label htmlFor="record-book" size="$4">
							書籍
						</Label>
						<Select
<<<<<<< Updated upstream:app/(tabs)/record/page.tsx
							id="record-book"
							value={selectedBookId ?? ""}
							onValueChange={setSelectedBookId}
						>
							<Select.Trigger
								width="100%"
								size="$5"
								iconAfter={ChevronDown}
								rounded="$3"
=======
							value={selectedBookId === null ? "" : String(selectedBookId)}
							onValueChange={(val: string) => setSelectedBookId(Number(val))}
						>
							<Select.Trigger
								width={160}
								iconAfter={ChevronDown}
								rounded={"$3"}
>>>>>>> Stashed changes:app/(tabs)/record.tsx
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
					</YStack>

					<YStack gap="$2">
						<Label htmlFor="record-page" size="$4">
							読み終わったページ
						</Label>
						<Input
							id="record-page"
							theme="surface1"
							width="100%"
							size="$5"
<<<<<<< Updated upstream:app/(tabs)/record/page.tsx
							placeholder="読み終わったページを入力"
							inputMode="numeric"
							value={pageReached}
							onChangeText={setPageReached}
							onSubmitEditing={submitProgress}
=======
							placeholder="今回読んだページ数を入力"
							keyboardType="numeric"
							value={pagesRead}
							onChangeText={(text) => setPagesRead(text)}
>>>>>>> Stashed changes:app/(tabs)/record.tsx
						/>
						<Paragraph size="$2" color="$gray10">
							{selected && selected.pages > 0
								? `そこまで読んだページ番号を入れてください (全 ${selected.pages} ページ)`
								: "そこまで読んだページ番号を入れてください (例: 104 ページで中断したら 104)"}
						</Paragraph>
					</YStack>

					<YStack gap="$2">
						<Label htmlFor="record-memo" size="$4">
							メモ
						</Label>
						<TextArea
							id="record-memo"
							theme="surface1"
							width="100%"
							minH={96}
							size="$4"
							placeholder="感想やメモ (任意)"
						/>
					</YStack>

					<Button size="$5" width="100%" onPress={submitProgress}>
						登録
					</Button>
				</YStack>
			</Card>
		</YStack>
	);
}
