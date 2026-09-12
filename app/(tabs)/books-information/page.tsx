"use client";

import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import { ChevronDown } from "@tamagui/lucide-icons-2/icons/ChevronDown";
import { Plus } from "@tamagui/lucide-icons-2/icons/Plus";
import { PageHeader } from "components/PageHeader";
import { useAuth } from "context/AuthContext";
import { sendJson } from "lib/api";
import { uuidv7 } from "lib/uuid";
import { useState } from "react";
import { BookResponseSchema } from "schemas/openapi";
import { Button, Card, H3, Input, Select, XStack, YStack } from "tamagui";

// 既知バグ #3 の UI 側。以前はここが固定文字列 "string" を送っており、
// サーバ側もそれを捨てて DB 既定値の "積読" を入れていた。両方まとめて直した。
const STATUSES = ["積読", "読書中", "読了"] as const;

export default function BooksInformationPage() {
	const [selectedBook, setSelectedBook] = useState<string>("");
	const { userId } = useAuth();
	const [book_pages, setBookPages] = useState<number | null>(null);
	const [status, setStatus] = useState<string>(STATUSES[0]);

	const submitProgress = async () => {
		// book_id はクライアントで作る (uuidv7)。サーバに採番させると
		// オフラインで本を登録できず、同期の再送も重複行を作る。
		await sendJson(
			"PUT",
			`/users/${userId}/books`,
			{
				book_id: uuidv7(),
				book_title: selectedBook,
				status,
				book_pages: book_pages,
			},
			BookResponseSchema,
		);
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
							<Select value={status} onValueChange={setStatus}>
								<Select.Trigger
									width={130}
									iconAfter={ChevronDown}
									rounded="$3"
								>
									<Select.Value placeholder="状態を選択" />
								</Select.Trigger>

								<Select.Content>
									<Select.Viewport>
										<Select.Group>
											{STATUSES.map((s, index) => (
												<Select.Item key={s} index={index} value={s}>
													<Select.ItemText>{s}</Select.ItemText>
													<Select.ItemIndicator>
														<Check size={16} />
													</Select.ItemIndicator>
												</Select.Item>
											))}
										</Select.Group>
									</Select.Viewport>
								</Select.Content>
							</Select>
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
