"use client";

import { useAuth } from "context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

/**
 * 旧 app/_layout.tsx の useProtectedRoute の移植。
 *
 * セッションは localStorage にしか無いので middleware からは見えない。
 * 認証は元々存在せず user_id はサーバが検証しないただの識別子なので、
 * cookie に移す利得が無い。クライアント側ガードのまま移す。
 *
 * 置き場所はルート。(tabs) のレイアウトに置くと /register と /modal で
 * そもそも描画されず、「ログイン済みで /register にいる」ケースが拾えない。
 */
export function AuthGuard({ children }: { children: ReactNode }) {
	const { userId, isLoading } = useAuth();
	const pathname = usePathname();
	const router = useRouter();

	useEffect(() => {
		// 保存済みセッションの読み込みが終わるまでは判定しない
		if (isLoading) return;

		if (!userId && pathname !== "/register") {
			router.replace("/register");
		} else if (userId && pathname === "/register") {
			router.replace("/record");
		}
	}, [userId, isLoading, pathname, router]);

	return <>{children}</>;
}
