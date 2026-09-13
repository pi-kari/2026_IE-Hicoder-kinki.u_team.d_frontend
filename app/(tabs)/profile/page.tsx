"use client";

import { Plus } from "@tamagui/lucide-icons-2/icons/Plus";
import { useBookCovers } from "components/useBookCovers";
import { ProfileWidget } from "components/widgets/ProfileWidget";
import { TreeWidget } from "components/widgets/TreeWidget";
import { useAuth } from "context/AuthContext";
import { useLocalDb } from "context/LocalDbContext";
import { listBooks } from "lib/local/repo";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { BookResponseSchema } from "schemas/openapi";
import { Button, Card, Image, XStack, YStack } from "tamagui";
import type z from "zod";

export default function ProfilePage() {
	const { userId } = useAuth();
	const { ready } = useLocalDb();
	const router = useRouter();
	const [books, setBooks] = useState<z.infer<typeof BookResponseSchema>[]>([]);
	// ISBN から取り込んだ表紙があれば使う (無ければプレースホルダ)。
	const coverOf = useBookCovers(books);

	useEffect(() => {
		// セッション復元前 / 未ログイン / DB 未準備のときは叩かない
		if (!userId || !ready) return;

		const fetchProgress = async () => {
			try {
				setBooks(await listBooks(userId));
			} catch (error) {
				console.error("進捗の取得に失敗しました:", error);
			}
		};

		fetchProgress();
	}, [userId, ready]);

	return (
		<YStack flex={1} p="$4" items="center" justify="center" gap="$4">
			<ProfileWidget />
			<Card
				width="100%"
				maxWidth={500}
				borderWidth={1}
				borderColor="$borderColor"
			>
				<XStack p="$3" gap="$3" items="center">
					{books.slice(-3).map((book) => (
						<Image
							key={book.book_id}
							src={coverOf(book)}
							width={65}
							height={90}
							objectFit="cover"
							rounded="$2"
						/>
					))}

					<Button
						size="$4"
						circular
						icon={Plus}
						aria-label="書籍を登録"
						onPress={() => router.push("/books-information")}
					/>
				</XStack>
			</Card>
			<TreeWidget />
		</YStack>
	);
}
