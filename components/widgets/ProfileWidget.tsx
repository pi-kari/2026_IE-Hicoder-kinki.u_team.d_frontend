"use client";

import { useAuth } from "context/AuthContext";
import { useLocalDb } from "context/LocalDbContext";
import { findUser } from "lib/local/repo";
import { avatar } from "lib/placeholder";
import { useEffect, useState } from "react";
import {
	Avatar,
	Button,
	Card,
	H3,
	Paragraph,
	Strong,
	Text,
	XStack,
	YStack,
} from "tamagui";

export function ProfileWidget() {
	const { userId } = useAuth();
	const { ready } = useLocalDb();
	// 登録したユーザー名。AuthContext は user_id しか持たないので、
	// 名前は端末内 DB から引く (オフラインでも出したいため)。
	const [userName, setUserName] = useState<string | null>(null);
	const [code, setCode] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		// セッション復元前 / 未ログイン / DB 未準備のときは叩かない
		if (!userId || !ready) return;

		let cancelled = false;
		findUser(userId).then(
			(user) => {
				if (!cancelled) setUserName(user?.username ?? null);
			},
			(error: unknown) => {
				// 名前が出せなくても他の表示は続けられる
				console.error("ユーザー名の取得に失敗しました", error);
			},
		);
		return () => {
			cancelled = true;
		};
	}, [userId, ready]);

	/**
	 * 別の端末で続きを使うための引き継ぎコードを出す。
	 *
	 * 以前はユーザー ID をそのまま表示して入力させていたが、それだと
	 * ID が実質の資格情報になり、画面に出ている値で他人のデータが読めてしまう。
	 * 10 分で失効する 1 回きりのコードに変えた。
	 */
	const issue = async () => {
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/auth/transfer", { method: "POST" });
			if (!res.ok) {
				setError(
					res.status === 401
						? "サーバとまだ同期できていません。オンラインにしてから試してください"
						: "コードを発行できませんでした",
				);
				return;
			}
			const data = (await res.json()) as { code: string };
			setCode(data.code);
		} catch (e) {
			console.error(e);
			setError("サーバに接続できませんでした");
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card
			width="100%"
			maxWidth={500}
			borderWidth={1}
			borderColor="$borderColor"
		>
			<XStack p="$3" gap="$3">
				<YStack flex={1} gap="$2" items="center" justify="center">
					<Avatar circular size="$6">
						<Avatar.Image src={avatar(userId ?? "anon")} />
					</Avatar>
					<Paragraph fontSize={12}>
						<Strong>{userName ?? "Name"}</Strong>
					</Paragraph>
				</YStack>
				<YStack flex={1} gap="$2">
					<H3 fontSize={18}>おすすめの本</H3>

					<Paragraph color="$gray11">感想文とか？</Paragraph>

					<Text color="$gray10" fontSize={12}>
						ニックネーム: {userName ?? "未設定"}
					</Text>
				</YStack>
			</XStack>

			<YStack px="$3" pb="$3" gap="$2">
				<Text color="$gray10" fontSize={12}>
					別の端末で続きを使う
				</Text>

				{code ? (
					<YStack gap="$1">
						<Text
							id="transfer-code"
							fontSize={20}
							fontFamily="$mono"
							selectable
						>
							{code}
						</Text>
						<Text color="$gray10" fontSize={11}>
							もう一方の端末の登録画面に入力してください。10 分で失効し、1
							回だけ使えます。
						</Text>
					</YStack>
				) : (
					<XStack gap="$2" items="center">
						<Button
							size="$2"
							disabled={busy}
							opacity={busy ? 0.6 : 1}
							onPress={issue}
						>
							引き継ぎコードを発行
						</Button>
					</XStack>
				)}

				{error ? (
					<Text color="$red10" fontSize={11}>
						{error}
					</Text>
				) : null}
			</YStack>
		</Card>
	);
}
