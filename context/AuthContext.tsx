import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { deleteItem, getItem, setItem } from "./sessionStorage";

const AuthContext = createContext<{
	userId: string | null;
	userName: string | null;
	isLoading: boolean;
	registerSession: (id: string, username: string) => Promise<void>;
	clearSession: () => Promise<void>;
} | null>(null);

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) throw new Error("useAuth must be used within an AuthProvider");
	return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [userId, setUserId] = useState<string | null>(null);
	const [userName, setUserName] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// アプリ起動時に保存されたIDとユーザー名を読み込む
	useEffect(() => {
		Promise.all([getItem("user_session"), getItem("user_name")])
			.then(([storedId, storedName]) => {
				if (storedId) setUserId(storedId);
				if (storedName) setUserName(storedName);
			})
			.catch((error) => {
				console.warn("セッションの読み込みに失敗しました", error);
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, []);

	// 登録成功時に呼ばれる関数
	const registerSession = async (id: string, username: string) => {
		await Promise.all([
			setItem("user_session", id),
			setItem("user_name", username),
		]);
		setUserId(id);
		setUserName(username);
	};

	// ログアウト（データ消去）
	const clearSession = async () => {
		await Promise.all([deleteItem("user_session"), deleteItem("user_name")]);
		setUserId(null);
		setUserName(null);
	};

	return (
		<AuthContext.Provider
			value={{ userId, userName, isLoading, registerSession, clearSession }}
		>
			{children}
		</AuthContext.Provider>
	);
}
