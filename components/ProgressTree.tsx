"use client";

import { useAuth } from "context/AuthContext";
import { getJson } from "lib/api";
import Image from "next/image";
import { useEffect, useState } from "react";
import { BookResponseSchema, ResponseTreeStateSchema } from "schemas/openapi";
import { z } from "zod";
import tree1 from "../public/images/tree_1.png";
import tree2 from "../public/images/tree_2.png";
import tree3 from "../public/images/tree_3.png";

const TREE_IMAGES = [tree1, tree2, tree3];

export function ProgressTree() {
	const { userId } = useAuth();
	const [progress, setProgress] = useState<number>(1);

	useEffect(() => {
		// セッション復元前 / 未ログインのときは叩かない
		if (!userId) return;

		const fetchProgress = async () => {
			try {
				// 以前は bookId = 5 のハードコードだった (既知バグ #6)。
				// 一覧の最後の本を使う。book_id は uuidv7 なので昇順 = 登録順。
				const books = await getJson(
					`/users/${userId}/books`,
					z.array(BookResponseSchema),
				);
				const target = books.at(-1);
				if (!target) return;

				const response = await getJson(
					`/users/${userId}/books/${target.book_id}/tree`,
					ResponseTreeStateSchema,
				);
				setProgress(response.tree_state);
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

	// Expo 版は「tamagui の Image が web で source を見ない」ため react-native の Image に
	// 逃がしていたが、Next では next/image の静的 import で素直に書ける。
	return (
		<Image
			src={TREE_IMAGES[index]}
			width={200}
			height={200}
			style={{ objectFit: "contain" }}
			alt={`成長段階 ${index + 1} の木`}
		/>
	);
}
