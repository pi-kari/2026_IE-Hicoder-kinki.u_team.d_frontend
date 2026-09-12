"use client";
import "./_page.css"

import "./_page.css";
import "./_page.css";
import "./_page.css";
import "./_page.css";
const _cn8 = "is_View _fd-column _pt-c-space-4 _pb-c-space-4 _items-center";
const _cn7 = "is_Paragraph is_Text font_body _ff-f-family _fw-f-weight-4 _ls-f-letterSpa1360334202 _fs-f-size-4 _lh-f-lineHeigh112923 _col-gray10 _select-auto _ws-normal";
const _cn6 = "is_View _fd-column _pt-c-space-10 _pb-c-space-10 _items-center _width-10037";
const _cn5 = "is_View _fd-row _grow-1 _shrink-1 _fb-0px";
const _cn4 = "is_View _fd-column _pr-c-space-2 _pl-c-space-2 _pb-c-space-2 _items-center";
const _cn3 = "is_H3 is_Text font_heading _select-auto _col-color _ws-normal _ff-f-family _fw-f-weight-8 _ls-f-letterSpa1360334198 _fs-14px _lh-18px _mt-0px _mr-0px _mb-0px _ml-0px";
const _cn2 = "is_View _fd-row _fwr-wrap _gap-c-space-3 _pr-c-space-4 _pl-c-space-4 _pt-c-space-4 _pb-c-space-4";
const _cn = "is_View _fd-column _grow-1 _shrink-1 _fb-0px _bg-background";
import { PageHeader } from "components/PageHeader";
import { useAuth } from "context/AuthContext";
import { getJson } from "lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookResponseSchema } from "schemas/openapi";
import { Button, Card, H3, Image, Paragraph, Spinner, XStack, YStack } from "tamagui";
import type z from "zod";
export default function BooksPage() {
  const {
    userId
  } = useAuth();
  const router = useRouter();
  const [books, setBooks] = useState<z.infer<typeof BookResponseSchema>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
			<PageHeader title="書籍一覧" />

			{/*
    * 旧版は FlatList の numColumns={3} と useWindowDimensions からの
    * cardWidth 計算で 3 列を作っていた。web では CSS に任せれば済むので
    * 幅の計算ごと削除し、flexWrap で折り返す。
    */}
			<div className={_cn2}>
				{books.map(book => <Card key={book.book_id} flexBasis="30%" flexGrow={1} minW={96} size="$3" borderWidth={1} borderColor="$borderColor">
						<Card.Header p="$2">
							<h3 className={_cn3}>
								{book.book_title}
							</h3>
						</Card.Header>

						<div className={_cn4}>
							<Image src={`https://placehold.co/200x280/png?text=${book.book_id}`} objectFit="cover" width="100%" aspectRatio={1 / 1.4} borderRadius={8} />
						</div>

						<Card.Footer p="$2">
							<div className={_cn5} />
							<Button size="$2" rounded="$8" onPress={() => router.push(`/books-information?bookId=${book.book_id}`)}>
								詳細
							</Button>
						</Card.Footer>
					</Card>)}
			</div>

			{!isLoading && books.length === 0 ? <div className={_cn6}>
					<p className={_cn7}>表示できる書籍データがありません</p>
				</div> : null}

			{isLoading ? <div className={_cn8}>
					<Spinner />
				</div> : null}
		</div>;
}