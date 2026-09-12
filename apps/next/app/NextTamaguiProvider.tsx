"use client";

import { ToastProvider, ToastViewport } from "@tamagui/toast";
import { NextThemeProvider, useRootTheme } from "@tamagui/next-theme";
import { useServerInsertedHTML } from "next/navigation";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { TamaguiProvider } from "tamagui";
import { CurrentToast } from "components/CurrentToast";
import { config } from "../tamagui.config";

export function NextTamaguiProvider({ children }: { children: ReactNode }) {
	const [theme, setTheme] = useRootTheme();

	// react-native-web はスタイルを実行時に <style> へ流し込む。
	// SSR の HTML にはそれが乗らないので、初回描画が素のままになる (FOUC)。
	// getSheet() で SSR 時点のシートを取り出して head に差し込む。
	useServerInsertedHTML(() => {
		// 型は react-native のものが解決されるが、実体は turbopack.resolveAlias で
		// react-native-web に差し替わっている。getSheet() は RNW 固有の API。
		const sheet = (
			StyleSheet as unknown as { getSheet(): { id: string; textContent: string } }
		).getSheet();
		return (
			<style
				// biome-ignore lint/security/noDangerouslySetInnerHtml: RNW の生成 CSS をそのまま挿す
				dangerouslySetInnerHTML={{ __html: sheet.textContent }}
				id={sheet.id}
			/>
		);
	});

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
