"use client";

import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import { ChevronDown } from "@tamagui/lucide-icons-2/icons/ChevronDown";
import { ScanBarcode } from "@tamagui/lucide-icons-2/icons/ScanBarcode";
import { BarcodeScanner } from "components/BarcodeScanner";
import { PageHeader } from "components/PageHeader";
import { useAuth } from "context/AuthContext";
import { useLocalDb } from "context/LocalDbContext";
import { lookupIsbn } from "lib/local/isbn";
import { createBook } from "lib/local/repo";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
	Button,
	Card,
	H3,
	Input,
	Label,
	Paragraph,
	Select,
	Spinner,
	XStack,
	YStack,
} from "tamagui";

// 既知バグ #3 の UI 側。以前はここが固定文字列 "string" を送っており、
// サーバ側もそれを捨てて DB 既定値の "積読" を入れていた。両方まとめて直した。
const STATUSES = ["積読", "読書中", "読了"] as const;

export default function BooksInformationPage() {
	const [selectedBook, setSelectedBook] = useState<string>("");
	const { userId } = useAuth();
	const { ready } = useLocalDb();
	const router = useRouter();
	const [book_pages, setBookPages] = useState<number | null>(null);
	const [status, setStatus] = useState<string>(STATUSES[0]);
	const [error, setError] = useState<string | null>(null);

	// ISBN はバーコードでも手入力でも入る。カメラが使えない端末
	// (デスクトップ / 許可拒否 / http 接続) では手入力が唯一の経路になる。
	const [isbnInput, setIsbnInput] = useState<string>("");
	const [isbn, setIsbn] = useState<string | null>(null);
	const [scanning, setScanning] = useState(false);
	const [looking, setLooking] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);

	/**
	 * スキャンと手入力の合流点。**経路を 1 本にしておく**ことで、
	 * カメラを使わない Playwright からも同じ処理を通せる。
	 */
	const applyIsbn = useCallback(
		async (raw: string) => {
			if (!userId) return;
			setScanning(false);
			setLooking(true);
			setError(null);
			setNotice(null);

			try {
				const found = await lookupIsbn(userId, raw);

				if (found.kind === "invalid") {
					setError(
						"ISBN として読み取れません。本の裏の 978 から始まる 13 桁を入力してください。",
					);
					return;
				}

				// **生の入力ではなく正規化済みの値を持つ。** ISBN-10 のハイフン付きを
				// 手入力されたとき、そのまま保存すると 10 桁のままになり、
				// 表紙の突き合わせも後の再取得も一致しなくなる。
				// 書誌が引けなかった場合も ISBN だけは控えて登録に載せる。
				setIsbn(found.isbn);
				setIsbnInput(found.isbn);

				switch (found.kind) {
					case "ok":
						setSelectedBook(found.meta.title);
						if (found.meta.pages !== null) {
							setBookPages(found.meta.pages);
						} else {
							// 版によっては dc:extent が無い。書名だけ埋めて先へ進ませる。
							setNotice(
								"ページ数を取得できませんでした。手で入力してください。",
							);
						}
						break;
					case "not-found":
						setNotice(
							"この ISBN の書籍情報が見つかりませんでした。手入力で登録できます。",
						);
						break;
					case "unauthorized":
						setNotice(
							"認証できませんでした。手入力で登録できます (登録後に同期されます)。",
						);
						break;
					case "offline":
						setNotice(
							"オフラインのため書籍情報を取得できません。手入力で登録できます。",
						);
						break;
					default:
						setNotice("書籍情報を取得できませんでした。手入力で登録できます。");
				}
			} finally {
				setLooking(false);
			}
		},
		[userId],
	);

	const submitProgress = async () => {
		if (!userId || !ready) return;
		if (!selectedBook.trim() || book_pages === null) {
			setError("タイトルとページ数を入力してください");
			return;
		}
		// **0 を通してはいけない。** Number("0") は null ではないのでこの上の
		// チェックを素通りし、ページ数 0 の本ができる。そうなると記録画面の
		// 「総ページ数を超えていないか」が判定できなくなり、何ページでも
		// 入力できてしまう (実測で確認)。進捗率の分母にもならない。
		if (!Number.isInteger(book_pages) || book_pages < 1) {
			setError("ページ数は 1 以上の数字で入力してください");
			return;
		}
		setError(null);
		try {
			// 端末内 DB に直接書く。オフラインでもここまでは必ず成功する。
			await createBook(userId, {
				bookTitle: selectedBook.trim(),
				status,
				bookPages: book_pages,
				isbn,
			});
			router.push("/record");
		} catch (e) {
			// HTTP を経由しなくなったので、失敗はステータスではなく例外で来る。
			console.error(e);
			setError("登録に失敗しました");
		}
	};

	return (
		<YStack flex={1} bg="$background">
			<PageHeader title="書籍情報を登録" />
			<YStack flex={1} items="center" gap="$6" px="$4" pt="$6">
				<Card
					width="100%"
					maxWidth={560}
					size="$4"
					borderWidth={1}
					borderColor="$borderColor"
				>
					{/* 以前は 1 行の XStack に 4 つ詰めていて、入力欄が狭く文字が
					    読めなかった。縦に積んで 1 つずつ全幅にしている。 */}
					<YStack p="$4" gap="$4">
						<H3>書籍情報を登録</H3>

						<YStack gap="$2">
							<Label htmlFor="isbn" size="$4">
								ISBN
							</Label>
							{/* バーコードで読むか、手で打つ。狭い画面では折り返す。 */}
							<XStack gap="$2" width="100%" flexWrap="wrap">
								<Input
									id="isbn"
									value={isbnInput}
									onChangeText={setIsbnInput}
									theme="surface1"
									flex={1}
									minW={180}
									size="$5"
									placeholder="ISBN を入力"
									inputMode="numeric"
									onSubmitEditing={() => void applyIsbn(isbnInput)}
								/>
								<Button
									size="$5"
									disabled={!ready || looking || isbnInput.trim() === ""}
									opacity={
										ready && !looking && isbnInput.trim() !== "" ? 1 : 0.6
									}
									onPress={() => void applyIsbn(isbnInput)}
								>
									{looking ? <Spinner /> : "取得"}
								</Button>
							</XStack>
							<Button
								icon={ScanBarcode}
								iconSize="$4"
								size="$5"
								width="100%"
								disabled={!ready || looking}
								opacity={ready && !looking ? 1 : 0.6}
								onPress={() => setScanning(true)}
							>
								バーコードで読み取る
							</Button>
						</YStack>

						<YStack gap="$2">
							<Label htmlFor="book-title" size="$4">
								タイトル
							</Label>
							<Input
								id="book-title"
								value={selectedBook}
								onChangeText={setSelectedBook}
								theme="surface1"
								width="100%"
								size="$5"
								placeholder="本のタイトルを入力"
							/>
						</YStack>

						<XStack gap="$3" width="100%" flexWrap="wrap">
							<YStack gap="$2" flex={1} minW={140}>
								<Label htmlFor="book-pages" size="$4">
									ページ数
								</Label>
								<Input
									id="book-pages"
									value={book_pages !== null ? book_pages.toString() : ""}
									// 空文字を Number() に通すと 0 になり、null チェックが
									// 素通りしてページ数 0 の本が作れてしまう。
									onChangeText={(text) =>
										setBookPages(text.trim() === "" ? null : Number(text))
									}
									theme="surface1"
									width="100%"
									size="$5"
									placeholder="ページ数を入力"
									inputMode="numeric"
								/>
							</YStack>

							<YStack gap="$2" flex={1} minW={140}>
								<Label htmlFor="book-status" size="$4">
									状態
								</Label>
								<Select
									id="book-status"
									value={status}
									onValueChange={setStatus}
								>
									<Select.Trigger
										width="100%"
										size="$5"
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
							</YStack>
						</XStack>

						{notice ? (
							<Paragraph id="isbn-notice" color="$orange10">
								{notice}
							</Paragraph>
						) : null}
						{error ? <Paragraph color="$red10">{error}</Paragraph> : null}

						<Button
							size="$5"
							width="100%"
							disabled={!ready}
							opacity={ready ? 1 : 0.6}
							onPress={submitProgress}
						>
							登録
						</Button>
					</YStack>
				</Card>
			</YStack>

			{scanning ? (
				<BarcodeScanner
					onDetected={(found) => void applyIsbn(found)}
					onClose={() => setScanning(false)}
				/>
			) : null}
		</YStack>
	);
}
