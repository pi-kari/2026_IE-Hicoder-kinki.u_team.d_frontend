// セッションIDの保存先。
// expo-secure-store はネイティブ専用モジュールなので、web では localStorage を使う。
// （web ビルドは output: "static" のため、SSR 中は window が無い点にも注意）
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

export async function getItem(key: string): Promise<string | null> {
	if (isWeb) {
		if (typeof window === "undefined") return null;
		return window.localStorage.getItem(key);
	}
	return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
	if (isWeb) {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(key, value);
		return;
	}
	await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
	if (isWeb) {
		if (typeof window === "undefined") return;
		window.localStorage.removeItem(key);
		return;
	}
	await SecureStore.deleteItemAsync(key);
}
