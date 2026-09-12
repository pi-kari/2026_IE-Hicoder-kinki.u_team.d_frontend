import "./globals.css";
import "./tamagui.generated.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "context/AuthContext";
import { AuthGuard } from "./AuthGuard";
import { NextTamaguiProvider } from "./NextTamaguiProvider";

export const metadata: Metadata = {
	title: "Hicoder",
	description: "読んだページ数を記録すると木が育つ読書進捗トラッカー",
	icons: "/favicon.png",
};

// 旧 app/+html.tsx の viewport meta と同じ。
export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	minimumScale: 1,
	maximumScale: 1.00001,
	viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="ja" suppressHydrationWarning>
			<body>
				<NextTamaguiProvider>
					<AuthProvider>
						<AuthGuard>{children}</AuthGuard>
					</AuthProvider>
				</NextTamaguiProvider>
			</body>
		</html>
	);
}
