"use client";

import { NextThemeProvider, useRootTheme } from "@tamagui/next-theme";
import { ToastProvider, ToastViewport } from "@tamagui/toast";
import { CurrentToast } from "components/CurrentToast";
import type { ReactNode } from "react";
import { TamaguiProvider } from "tamagui";
import { config } from "../tamagui.config";

/**
 * 旧 components/Provider.tsx の置き換え。
 *
 * テーマは react-native の useColorScheme ではなく @tamagui/next-theme から取る。
 * disableRootThemeClass を付けて、テーマクラスは NextThemeProvider に一本化する。
 *
 * NOTE: react-native-web のシートを useServerInsertedHTML で差し込む手当ては入れない。
 * Tamagui の web ビルドは RNW を使わず、スタイルは tamagui.generated.css と
 * アトミッククラスとして SSR HTML に乗るため不要。
 */
export function NextTamaguiProvider({ children }: { children: ReactNode }) {
	const [theme, setTheme] = useRootTheme();

	return (
		<NextThemeProvider
			skipNextHead
			onChangeTheme={(next) => {
				setTheme(next as "light" | "dark");
			}}
		>
			<TamaguiProvider config={config} disableRootThemeClass defaultTheme={theme}>
				<ToastProvider swipeDirection="horizontal" duration={6000}>
					{children}
					<CurrentToast />
					<ToastViewport top="$8" left={0} right={0} />
				</ToastProvider>
			</TamaguiProvider>
		</NextThemeProvider>
	);
}
