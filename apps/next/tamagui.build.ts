import type { TamaguiBuildOptions } from "tamagui";

export default {
	components: ["tamagui"],
	config: "./tamagui.config.ts",
	// レイアウトから静的 import するのでアプリ内に出す。
	// 生成物は git にコミットする (クリーンチェックアウトで next dev が落ちないように)。
	outputCSS: "./app/tamagui.generated.css",
} satisfies TamaguiBuildOptions;
