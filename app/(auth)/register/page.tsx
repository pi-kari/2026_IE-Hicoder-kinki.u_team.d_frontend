"use client";

import { useAuth } from "context/AuthContext";
import { useLocalDb } from "context/LocalDbContext";
import { createUser } from "lib/local/repo";
import { joinWithTransferCode } from "lib/local/sync";
import { useState } from "react";
import { Button, H2, Input, Paragraph, Separator, YStack } from "tamagui";

export default function RegisterPage() {
	const { registerSession } = useAuth();
	const { ready } = useLocalDb();
	const [username, setUsername] = useState("");
	const [transferCode, setTransferCode] = useState("");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// 端末内 DB (WASM) の起動には実測で初回数秒かかる。準備前に押せてしまうと
	// 「押したのに何も起きない」ことになるので、押させない。
	const busy = isSubmitting || !ready;

	const handleRegister = async () => {
		const trimmedName = username.trim();
		if (!trimmedName) {
			setErrorMessage("ユーザー名を入力してください");
			return;
		}

		setErrorMessage(null);
		setIsSubmitting(true);
		try {
			// 端末内 DB に直接作る。オフラインでも登録できる。
			// user_id はクライアント生成の uuidv7 なので、後からサーバへ送っても衝突しない。
			//
			// 以前はここだけ素の fetch でステータスコードを見ていたが、
			// HTTP を経由しなくなったので失敗は例外で来る。
			const user = await createUser(trimmedName);

			// ログイン API が無いので、この瞬間に端末をユーザーと紐付ける
			// (保存後は app/AuthGuard.tsx がメイン画面へ遷移させる)
			await registerSession(user.user_id);
		} catch (error) {
			console.error(error);
			setErrorMessage("登録に失敗しました");
		} finally {
			setIsSubmitting(false);
		}
	};

	/**
	 * 2 台目の端末をこのユーザーに合流させる。
	 *
	 * このアプリにログインは無く、/register は常に新規ユーザーを作る。
	 * それだけだと「別の端末で同じユーザーを続ける」手段が無く、
	 * サーバ同期を入れても意味が無い。
	 *
	 * 1 台目のプロフィール画面で発行する**引き継ぎコード**を使う。
	 * ユーザー ID を入力させる方式にはしない。それだと ID が実質の資格情報に
	 * なり、画面に表示している値で他人のデータが読めてしまう。
	 *
	 * 合流だけはオフラインではできない (サーバがセッションを張るため)。
	 */
	const handleContinue = async () => {
		const code = transferCode.trim();
		if (code.length < 4) {
			setErrorMessage("引き継ぎコードを入力してください");
			return;
		}

		setErrorMessage(null);
		setIsSubmitting(true);
		try {
			const joinedUserId = await joinWithTransferCode(code);
			if (!joinedUserId) {
				setErrorMessage("コードが正しくないか、有効期限が切れています");
				return;
			}
			await registerSession(joinedUserId);
		} catch (error) {
			console.error(error);
			setErrorMessage("サーバに接続できませんでした");
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
				disabled={busy}
				opacity={busy ? 0.6 : 1}
				onPress={handleRegister}
			>
				{!ready ? "準備中..." : isSubmitting ? "登録中..." : "登録して始める"}
			</Button>

			<Separator width="100%" maxW={320} my="$2" />

			<Paragraph size="$2" text="center" maxW={320}>
				別の端末で使っていた場合は、その端末のプロフィール画面で発行した
				引き継ぎコードを入力すると続きから使えます。
			</Paragraph>

			<Input
				width="100%"
				maxW={320}
				placeholder="引き継ぎコード"
				value={transferCode}
				onChangeText={(t: string) => setTransferCode(t.toUpperCase())}
				autoCapitalize="characters"
				onSubmitEditing={handleContinue}
			/>

			<Button
				width="100%"
				maxW={320}
				disabled={busy}
				opacity={busy ? 0.6 : 1}
				onPress={handleContinue}
			>
				引き継ぎコードで続ける
			</Button>
		</YStack>
	);
}
