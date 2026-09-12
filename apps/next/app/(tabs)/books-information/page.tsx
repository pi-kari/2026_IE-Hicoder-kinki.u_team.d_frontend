"use client";
import "./_page.css"

import "./_page.css";
import "./_page.css";
import "./_page.css";
import "./_page.css";
const _cn4 = "is_View _fd-row _items-center _gap-c-space-2 _width-10037 _pt-c-space-3";
const _cn3 = "is_H3 is_Text font_heading _select-auto _col-color _ws-normal _ff-f-family _fw-f-weight-8 _ls-f-letterSpa1360334198 _fs-f-size-8 _lh-f-lineHeigh112927 _mt-0px _mr-0px _mb-0px _ml-0px";
const _cn2 = "is_View _fd-column _grow-1 _shrink-1 _fb-0px _items-center _gap-c-space-6 _pr-c-space-5 _pl-c-space-5 _pt-c-space-6";
const _cn = "is_View _fd-column _grow-1 _shrink-1 _fb-0px _bg-background";
import { Plus } from "@tamagui/lucide-icons-2/icons/Plus";
import { PageHeader } from "components/PageHeader";
import { useAuth } from "context/AuthContext";
import { getItem, setItem } from "context/sessionStorage";
import { sendJson } from "lib/api";
import { useState } from "react";
import { BookResponseSchema } from "schemas/openapi";
import { Button, Card, H3, Input, XStack, YStack } from "tamagui";
export default function BooksInformationPage() {
  const [selectedBook, setSelectedBook] = useState<string>("");
  const {
    userId
  } = useAuth();
  const [book_pages, setBookPages] = useState<number | null>(null);
  const submitProgress = async () => {
    // サーバーへPUTリクエストを送信
    // NOTE: status は API 側で無視され常に "積読" になる。サーバだけ直すと
    // この "string" が全レコードを汚染するので、UI に状態選択を足すまで据え置く。
    const response = await sendJson("PUT", `/users/${userId}/books`, {
      book_title: selectedBook,
      status: "string",
      book_pages: book_pages
    }, BookResponseSchema);
    const storedBookIds = await getItem("registered_book_ids");
    const registeredBookIds: number[] = storedBookIds ? JSON.parse(storedBookIds) : [];
    if (!registeredBookIds.includes(response.book_id)) {
      registeredBookIds.push(response.book_id);
    }
    await setItem("registered_book_ids", JSON.stringify(registeredBookIds));
  };
  return <div className={_cn}>
			<PageHeader title="書籍情報を登録" />
			<div className={_cn2}>
				<Card width="100%" maxWidth={500} size="$4" borderWidth={1} borderColor="$borderColor">
					<Card.Header p="$4" gap="$1">
						<h3 className={_cn3}>書籍情報を登録</h3>
						<div className={_cn4}>
							<Button icon={Plus} iconSize="$4" size="$5">
								写真を追加
							</Button>
							<Input value={selectedBook} onChangeText={setSelectedBook} theme="surface1" flex={1} size="$5" placeholder="本のタイトルを入力" />
							<Input value={book_pages !== null ? book_pages.toString() : ""} onChangeText={text => setBookPages(Number(text))} theme="surface1" flex={1} size="$5" placeholder="ページ数を入力" inputMode="numeric" />
							<Button size="$5" onPress={submitProgress}>
								登録
							</Button>
						</div>
					</Card.Header>
				</Card>
			</div>
		</div>;
}