import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { deleteItem, getItem, setItem } from "./sessionStorage";

const AuthContext = createContext<{
	userId: string | null;
	isLoading: boolean;
	registerSession: (id: string) => Promise<void>;
	clearSession: () => Promise<void>;
} | null>(null);

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) throw new Error("useAuth must be used within an AuthProvider");
	return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [userId, setUserId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// アプリ起動時に保存されたIDを読み込む
	useEffect(() => {
		getItem("user_session")
			.then((storedId) => {
				if (storedId) setUserId(storedId);
			})
			.catch((error) => {
				console.warn("セッションの読み込みに失敗しました", error);
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, []);

	// 登録成功時に呼ばれる関数
	const registerSession = async (id: string) => {
		await setItem("user_session", id);
		setUserId(id);
	};

	// ログアウト（データ消去）
	const clearSession = async () => {
		await deleteItem("user_session");
		setUserId(null);
	};

	return (
		<AuthContext.Provider
			value={{ userId, isLoading, registerSession, clearSession }}
		>
			{children}
		</AuthContext.Provider>
	);
}
