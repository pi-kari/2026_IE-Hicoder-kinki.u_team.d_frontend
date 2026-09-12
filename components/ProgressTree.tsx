"use client";

import { useAuth } from "context/AuthContext";
import { useLocalDb } from "context/LocalDbContext";
import { getTreeState } from "lib/local/repo";
import Image from "next/image";
import { useEffect, useState } from "react";
import tree1 from "../public/images/tree_1.png";
import tree2 from "../public/images/tree_2.png";
import tree3 from "../public/images/tree_3.png";

const TREE_IMAGES = [tree1, tree2, tree3];

export function ProgressTree() {
	const { userId } = useAuth();
	const { ready } = useLocalDb();
	const [progress, setProgress] = useState<number>(1);

	useEffect(() => {
		// セッション復元前 / 未ログイン / DB 未準備のときは叩かない
		if (!userId || !ready) return;

		const fetchProgress = async () => {
			try {
				// 以前は bookId = 5 のハードコードだった (既知バグ #6)。
				// 直近に進捗を記録した本 (無ければ最後に登録した本) を使う。
				const tree = await getTreeState(userId);
				if (tree) setProgress(tree.tree_state);
			} catch (error) {
				console.error("進捗の取得に失敗しました:", error);
			}
		};

		fetchProgress();
	}, [userId, ready]);

	const index = Math.min(
		Math.max(Math.round(progress) - 1, 0),
		TREE_IMAGES.length - 1,
	);

	// Expo 版は「tamagui の Image が web で source を見ない」ため react-native の Image に
	// 逃がしていたが、Next では next/image の静的 import で素直に書ける。
	return (
		<Image
			src={TREE_IMAGES[index]}
			width={200}
			height={200}
			// 最適化を通すと /_next/image?url=... になり、オフラインで落ちる。
			// 元画像は数十 KB なのでそのまま配る。
			unoptimized
			style={{ objectFit: "contain" }}
			alt={`成長段階 ${index + 1} の木`}
		/>
	);
}
