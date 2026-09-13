"use client";

import { getCovers } from "lib/local/covers";
import { bookCover } from "lib/placeholder";
import { useCallback, useEffect, useState } from "react";

/**
 * 本の表紙を解決する。ISBN から取り込んだ実物があればそれを、
 * 無ければ lib/placeholder.ts の SVG を返す。
 *
 * 実表紙は端末内の book_covers にしか無い (同期していない) ので、
 * 別の端末や ISBN 無しで登録した本はプレースホルダのままになる。
 * どちらの場合も data URI なので、オフラインで画像だけ壊れることはない。
 */

type CoverTarget = {
	book_id: string;
	book_title: string;
	isbn?: string | null;
};

export function useBookCovers(books: CoverTarget[]) {
	const [covers, setCovers] = useState<Map<string, string>>(new Map());

	// books は毎描画で新しい配列になるので、そのまま依存に置くと
	// effect が回り続ける。ISBN の並びだけを鍵にする。
	const key = books
		.map((b) => b.isbn)
		.filter((s): s is string => Boolean(s))
		.join(",");

	useEffect(() => {
		let cancelled = false;
		const isbns = key === "" ? [] : key.split(",");
		if (isbns.length === 0) {
			setCovers(new Map());
			return;
		}
		getCovers(isbns).then(
			(found) => {
				if (!cancelled) setCovers(found);
			},
			(error: unknown) => {
				// 表紙が引けなくてもプレースホルダで表示は続く。
				console.error(error);
			},
		);
		return () => {
			cancelled = true;
		};
	}, [key]);

	return useCallback(
		(book: CoverTarget): string =>
			(book.isbn ? covers.get(book.isbn) : null) ??
			bookCover(book.book_id, book.book_title),
		[covers],
	);
}
