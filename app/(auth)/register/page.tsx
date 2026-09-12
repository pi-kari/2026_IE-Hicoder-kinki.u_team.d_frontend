"use client";

import { useAuth } from "context/AuthContext";
import { apiUrl } from "lib/api";
import { uuidv7 } from "lib/uuid";
import { useState } from "react";
import { Button, H2, Input, Paragraph, YStack } from "tamagui";

export default function RegisterPage() {
	const { registerSession } = useAuth();
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
			// user_id はクライアントで作る。オフラインでも登録できる必要があるので
			// サーバ採番には戻さない (主キーは uuidv7)。
			const userId = uuidv7();
			const response = await fetch(apiUrl("/users"), {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ user_id: userId, username: trimmedName }),
			});

			if (!response.ok) {
				setErrorMessage(`登録に失敗しました (${response.status})`);
				return;
			}

			// 2. 成功したら、返ってきたユーザーIDでセッションを開始する
			//    ログインAPIがないため、この瞬間に端末をユーザーと紐付ける
			//    （保存後は app/AuthGuard.tsx がメイン画面へ遷移させる）
			const data: { user_id: string } = await response.json();
			await registerSession(data.user_id);
		} catch (error) {
			console.error(error);
			setErrorMessage("サーバーに接続できませんでした");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<YStack
			flex={1}
			minH="100vh"
			justify="center"
			items="center"
			gap="$4"
			p="$6"
			bg="$background"
		>
			<H2>新規登録</H2>

			<Input
				width="100%"
				maxW={320}
				placeholder="ユーザー名"
				value={username}
				onChangeText={setUsername}
				autoCapitalize="none"
				onSubmitEditing={handleRegister}
			/>

			{errorMessage ? (
				<Paragraph color="$red10" text="center">
					{errorMessage}
				</Paragraph>
			) : null}

			<Button
				width="100%"
				maxW={320}
				theme="green"
				disabled={isSubmitting}
				opacity={isSubmitting ? 0.6 : 1}
				onPress={handleRegister}
			>
				{isSubmitting ? "登録中..." : "登録して始める"}
			</Button>
		</YStack>
	);
}
