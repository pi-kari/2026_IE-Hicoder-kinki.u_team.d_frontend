"use client";

import { useAuth } from "context/AuthContext";
import { avatar } from "lib/placeholder";
import { useState } from "react";
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
	const [copied, setCopied] = useState(false);

	// このアプリにログインは無く、/register は常に新規ユーザーを作る。
	// 別の端末で続きを使うにはこの ID を入力してもらうしかないので、
	// 見えるところに出してコピーできるようにしておく。
	const copyUserId = async () => {
		if (!userId) return;
		try {
			await navigator.clipboard.writeText(userId);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// クリップボードが使えない環境 (http や権限拒否) では選択してもらう
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
						<Strong>Name</Strong>
					</Paragraph>
				</YStack>
				<YStack flex={1} gap="$2">
					<H3 fontSize={18}>おすすめの本</H3>

					<Paragraph color="$gray11">感想文とか？</Paragraph>

					<Text color="$gray10" fontSize={12}>
						ニックネーム: Hicoder
					</Text>
				</YStack>
			</XStack>

			<YStack px="$3" pb="$3" gap="$1">
				<Text color="$gray10" fontSize={12}>
					ユーザー ID（別の端末で続きを使うときに入力します）
				</Text>
				<XStack gap="$2" items="center">
					<Text
						id="user-id"
						flex={1}
						fontSize={11}
						fontFamily="$mono"
						color="$gray11"
						selectable
					>
						{userId ?? "—"}
					</Text>
					<Button size="$2" onPress={copyUserId} disabled={!userId}>
						{copied ? "コピーしました" : "コピー"}
					</Button>
				</XStack>
			</YStack>
		</Card>
	);
}
