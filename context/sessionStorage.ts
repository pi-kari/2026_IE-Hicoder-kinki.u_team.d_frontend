// セッションIDの保存先。
// Expo 時代は native の expo-secure-store と web の localStorage を Platform.OS で
// 分岐していたが、native を廃止したので localStorage だけになった。
//
// typeof window のガードは残す。Next は SSR / RSC でこのモジュールを評価しうるため、
// 静的エクスポートだった頃より重要になっている。

export async function getItem(key: string): Promise<string | null> {
	if (typeof window === "undefined") return null;
	return window.localStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(key, value);
}

export async function deleteItem(key: string): Promise<void> {
	if (typeof window === "undefined") return;
	window.localStorage.removeItem(key);
}
