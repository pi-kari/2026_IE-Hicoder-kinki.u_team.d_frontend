"use client";

import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import { ChevronDown } from "@tamagui/lucide-icons-2/icons/ChevronDown";
import { Toaster, toast } from "@tamagui/toast/v2";
import { useAuth } from "context/AuthContext";
import { useLocalDb } from "context/LocalDbContext";
import { listBooks, recordProgress } from "lib/local/repo";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

type BookChoice = { id: string; title: string; pages: number };

export default function RecordPage() {
	const router = useRouter();
	const { userId, isLoading } = useAuth();
	const { ready } = useLocalDb();

	// 本の一覧。book_id は uuid なので string。
	const [books, setBooks] = useState<BookChoice[]>([]);

	const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
	// 「そのとき読み終わったページ番号」。読んだページ数ではない。
	const [pageReached, setPageReached] = useState<string>("");

	useEffect(() => {
		if (isLoading || userId === null || !ready) {
			return;
		}

		const fetchBooks = async () => {
			try {
				const response = await listBooks(userId);

				if (response.length === 0) {
					router.push("/books-information");
				}

				const list = response.map((book) => ({
					id: book.book_id,
					title: book.book_title,
					pages: book.book_pages,
				}));
				setBooks(list);

				// 以前は localStorage の registered_book_ids から最後の本を復元していたが、
				// book_id が uuidv7 (時刻順) になったので一覧の末尾がそのまま
				// 「最後に登録した本」になる。二重管理をやめて実データだけを見る。
				setSelectedBookId(list.at(-1)?.id ?? null);
			} catch (error) {
				console.error("Failed to fetch books:", error);
			}
		};
		fetchBooks();
	}, [isLoading, userId, ready, router]);

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
		// 104 のつもりで 1040 と打つ間違いを拾う。ページ数 0 の本は判定できない。
		if (selected && selected.pages > 0 && page > selected.pages) {
			toast.error(`この本は ${selected.pages} ページまでです`);
			return;
		}

		if (!userId) return;

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
							id="record-book"
							value={selectedBookId ?? ""}
							onValueChange={setSelectedBookId}
						>
							<Select.Trigger
								width="100%"
								size="$5"
								iconAfter={ChevronDown}
								rounded="$3"
							>
								<Select.Value placeholder="書籍を選択" />
							</Select.Trigger>

							<Select.Content>
								<Select.Viewport>
									<Select.Group>
										{books.map((book, index) => (
											<Select.Item key={book.id} index={index} value={book.id}>
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
							placeholder="読み終わったページを入力"
							inputMode="numeric"
							value={pageReached}
							onChangeText={setPageReached}
							onSubmitEditing={submitProgress}
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
