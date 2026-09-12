"use client";
import "./_page.css"

import "./_page.css";
import "./_page.css";
import "./_page.css";
import "./_page.css";
const _cn2 = "is_View _fd-row _pt-c-space-3 _pr-c-space-3 _pb-c-space-3 _pl-c-space-3 _gap-c-space-3 _items-center";
const _cn = "is_View _fd-column _grow-1 _shrink-1 _fb-0px _pt-c-space-4 _pr-c-space-4 _pb-c-space-4 _pl-c-space-4 _items-center _justify-center _gap-c-space-4";
import { Plus } from "@tamagui/lucide-icons-2/icons/Plus";
import { ProfileWidget } from "components/widgets/ProfileWidget";
import { TreeWidget } from "components/widgets/TreeWidget";
import { useAuth } from "context/AuthContext";
import { getJson } from "lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookResponseSchema } from "schemas/openapi";
import { Button, Card, Image, XStack, YStack } from "tamagui";
import type z from "zod";
export default function ProfilePage() {
  const {
    userId
  } = useAuth();
  const router = useRouter();
  const [books, setBooks] = useState<z.infer<typeof BookResponseSchema>[]>([]);
  useEffect(() => {
    // セッション復元前 / 未ログインのときは叩かない
    if (!userId) return;
    const fetchProgress = async () => {
      try {
        const response = await getJson(`/users/${userId}/books`, BookResponseSchema.array());
        setBooks(response);
      } catch (error) {
        console.error("進捗の取得に失敗しました:", error);
      }
    };
    fetchProgress();
  }, [userId]);
  return <div className={_cn}>
			<ProfileWidget />
			<Card width="100%" maxWidth={500} borderWidth={1} borderColor="$borderColor">
				<div className={_cn2}>
					{books.slice(-3).map(book => <Image key={book.book_id} src={`https://placehold.co/200x280/png?text=${book.book_id}`} width={65} height={90} objectFit="cover" rounded="$2" />)}

					<Button size="$4" circular icon={Plus} aria-label="書籍を登録" onPress={() => router.push("/books-information")} />
				</div>
			</Card>
			<TreeWidget />
		</div>;
}