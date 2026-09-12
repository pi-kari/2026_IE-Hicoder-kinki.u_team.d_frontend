import "./globals.css";
import "./tamagui.generated.css";

import { ServiceWorkerRegistration } from "components/ServiceWorkerRegistration";
import { SyncStatus } from "components/SyncStatus";
import { AuthProvider } from "context/AuthContext";
import { LocalDbProvider } from "context/LocalDbContext";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
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
				<ServiceWorkerRegistration />
				<NextTamaguiProvider>
					{/* 端末内 DB は認証より外側。DB が開けなければセッションも扱えない */}
					<LocalDbProvider>
						<AuthProvider>
							<SyncStatus />
							<AuthGuard>{children}</AuthGuard>
						</AuthProvider>
					</LocalDbProvider>
				</NextTamaguiProvider>
			</body>
		</html>
	);
}
