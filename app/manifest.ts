import type { MetadataRoute } from "next";

// Next 16 内蔵のマニフェスト。Service Worker は内蔵していないので
// public/sw.js を別途用意している (scripts/gen-sw.ts が生成)。
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Hicoder — 読書進捗トラッカー",
		short_name: "Hicoder",
		description: "読んだページ数を記録すると木が育つ読書進捗トラッカー",
		start_url: "/",
		display: "standalone",
		background_color: "#f6f3ea",
		theme_color: "#3f9a52",
		lang: "ja",
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
			{
				src: "/icons/icon-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
		],
	};
}
