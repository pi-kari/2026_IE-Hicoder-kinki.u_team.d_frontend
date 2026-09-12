"use client";
import "./_page.css"

import "./_page.css";
import "./_page.css";
import "./_page.css";
import "./_page.css";
const _cn3 = "is_Paragraph is_Text font_body _ff-f-family _fw-f-weight-4 _ls-f-letterSpa1360334202 _fs-f-size-4 _lh-f-lineHeigh112923 _col-red10 _select-auto _ws-normal _text-center";
const _cn2 = "is_H2 is_Text font_heading _select-auto _col-color _ws-normal _ff-f-family _fw-f-weight-9 _ls-f-letterSpa1360334197 _fs-f-size-9 _lh-f-lineHeigh112928 _mt-0px _mr-0px _mb-0px _ml-0px";
const _cn = "is_View _fd-column _grow-1 _shrink-1 _fb-0px _minH-100vh _justify-center _items-center _gap-c-space-4 _pt-c-space-6 _pr-c-space-6 _pb-c-space-6 _pl-c-space-6 _bg-background";
import { useAuth } from "context/AuthContext";
import { apiUrl } from "lib/api";
import { useState } from "react";
import { Button, H2, Input, Paragraph, YStack } from "tamagui";
export default function RegisterPage() {
  const {
    registerSession
  } = useAuth();
  const [username, setUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleRegister = async () => {
    const trimmedName = username.trim();
    if (!trimmedName) {
      setErrorMessage("ユーザー名を入力してください");
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      // 1. バックエンドの登録APIを叩く
      //    ステータスコードを見たいので lib/api の sendJson ではなく素の fetch を使う
      const response = await fetch(apiUrl("/users"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: trimmedName
        })
      });
      if (!response.ok) {
        setErrorMessage(`登録に失敗しました (${response.status})`);
        return;
      }

      // 2. 成功したら、返ってきたユーザーIDでセッションを開始する
      //    ログインAPIがないため、この瞬間に端末をユーザーと紐付ける
      //    （保存後は app/AuthGuard.tsx がメイン画面へ遷移させる）
      const data: {
        user_id: number;
      } = await response.json();
      await registerSession(String(data.user_id));
    } catch (error) {
      console.error(error);
      setErrorMessage("サーバーに接続できませんでした");
    } finally {
      setIsSubmitting(false);
    }
  };
  return <div className={_cn}>
			<h2 className={_cn2}>新規登録</h2>

			<Input width="100%" maxW={320} placeholder="ユーザー名" value={username} onChangeText={setUsername} autoCapitalize="none" onSubmitEditing={handleRegister} />

			{errorMessage ? <p className={_cn3}>
					{errorMessage}
				</p> : null}

			<Button width="100%" maxW={320} theme="green" disabled={isSubmitting} opacity={isSubmitting ? 0.6 : 1} onPress={handleRegister}>
				{isSubmitting ? "登録中..." : "登録して始める"}
			</Button>
		</div>;
}