"use client";

import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import { ChevronDown } from "@tamagui/lucide-icons-2/icons/ChevronDown";
import { Toaster, toast } from "@tamagui/toast/v2";
import { useAuth } from "context/AuthContext";
import { getJson, sendJson } from "lib/api";
import { useRouter } from "next/navigation";
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

export default function RecordPage() {
	const router = useRouter();
	const { userId, isLoading } = useAuth();

	// 本の一覧。book_id は uuid なので string。
	const [books, setBooks] = useState<{ id: string; title: string }[]>([]);

	// 選択された本のIDと、入力されたページ数を保持するステートを追加
	const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
	const [pagesRead, setPagesRead] = useState<string>("");

	useEffect(() => {
		if (isLoading || userId === null) {
			return;
		}

		const fetchBooks = async () => {
			try {
				const response = await getJson(
					`/users/${userId}/books`,
					BookResponseSchema.array(),
				);

				if (response.length === 0) {
					router.push("/books-information");
				}

				const list = response.map((book) => ({
					id: book.book_id,
					title: book.book_title,
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
		const response = await sendJson(
			"POST",
			`/users/${userId}/books/${selectedBookId}/progress`,
			{ pages_read: Number(pagesRead) },
			ProgressUpdateResponseSchema,
		);

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
							value={selectedBookId ?? ""}
							onValueChange={setSelectedBookId}
						>
							<Select.Trigger width={160} iconAfter={ChevronDown} rounded="$3">
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

						<Input
							theme="surface1"
							flex={1}
							size="$5"
							placeholder="今回読んだページ数を入力"
							inputMode="numeric"
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
