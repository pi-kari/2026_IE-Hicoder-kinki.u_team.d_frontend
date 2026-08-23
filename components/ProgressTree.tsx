import { useAuth } from "context/AuthContext";
import { fetch } from "expo/fetch";
import { useEffect, useState } from "react";
import { Image } from "react-native";
import { ProgressResponseSchema } from "schemas/openapi";
import { z } from "zod";

// require はビルド時に静的解決されるため、変数で組み立てず配列に列挙する
const TREE_IMAGES = [
	require("../assets/images/tree_1.png"),
	require("../assets/images/tree_2.png"),
	require("../assets/images/tree_3.png"),
];

// このエンドポイントは本ごとの進捗の配列を返す
const ProgressListSchema = z.array(ProgressResponseSchema);

export function ProgressTree() {
	const { userId } = useAuth();
	const [progress, setProgress] = useState<number>(1);

	useEffect(() => {
		// セッション復元前 / 未ログインのときは叩かない
		if (!userId) return;

		const fetchProgress = async () => {
			try {
				const response = await fetch(
					`${process.env.EXPO_PUBLIC_BACKEND_URL}/user/${userId}/books/totalpages/`,
					{
						method: "GET",
					},
				);

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const json = await response.json();
				const books = ProgressListSchema.parse(json);
				const total = books.reduce((sum, book) => sum + book.progress, 0);
				setProgress(total);
			} catch (error) {
				console.error("進捗の取得に失敗しました:", error);
			}
		};

		fetchProgress();
	}, [userId]);

	const index = Math.min(
		Math.max(Math.round(progress) - 1, 0),
		TREE_IMAGES.length - 1,
	);

	// tamagui の Image は web ビルドだと <img> に props を流すだけで source を見ない
	// （src 文字列専用）。require() のローカル画像は react-native 側の Image を使う。
	return (
		<Image
			source={TREE_IMAGES[index]}
			style={{ width: 200, height: 200, resizeMode: "contain" }}
			accessibilityLabel={`成長段階 ${index + 1} の木`}
		/>
	);
}
