import "../tamagui.generated.css";

import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from "@react-navigation/native";
import { Provider } from "components/Provider";
import { useFonts } from "expo-font";
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { useTheme } from "tamagui";
import { AuthProvider, useAuth } from "../context/AuthContext";

export {
	// Catch any errors thrown by the Layout component.
	ErrorBoundary,
} from "expo-router";

// セッションの有無に応じて登録画面 / メイン画面へ振り分ける。
// ルートの <Stack> と同じコンポーネントで呼ぶことで、ナビゲーションの
// マウント後に replace が走るようにしている。
function useProtectedRoute() {
	const { userId, isLoading } = useAuth();
	const segments = useSegments();
	const router = useRouter();

	useEffect(() => {
		// 保存済みセッションの読み込みが終わるまでは判定しない
		if (isLoading) return;

		// 現在のルーティンググループを確認
		const inAuthGroup = segments[0] === "(auth)";

		if (!userId && !inAuthGroup) {
			// セッションがなく、認証画面以外にいる場合は登録画面へ
			router.replace("/(auth)/register");
		} else if (userId && inAuthGroup) {
			// セッションがあり、認証画面にいる場合はメイン画面へ
			router.replace("/(tabs)/record");
		}
	}, [userId, isLoading, segments, router]);
}

export const unstable_settings = {
	// Ensure that reloading on `/modal` keeps a back button present.
	initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const [interLoaded, interError] = useFonts({
		Inter: require("@tamagui/font-inter/otf/Inter-Medium.otf"),
		InterBold: require("@tamagui/font-inter/otf/Inter-Bold.otf"),
	});

	useEffect(() => {
		if (interLoaded || interError) {
			// Hide the splash screen after the fonts have loaded (or an error was returned) and the UI is ready.
			SplashScreen.hideAsync();
		}
	}, [interLoaded, interError]);

	if (!interLoaded && !interError) {
		return null;
	}

	return (
		<AuthProvider>
			<Provider>
				<RootLayoutNav />
			</Provider>
		</AuthProvider>
	);
}

function RootLayoutNav() {
	const colorScheme = useColorScheme();
	const theme = useTheme();
	useProtectedRoute();
	return (
		<ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
			<StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
			<Stack>
				<Stack.Screen
					name="(tabs)"
					options={{
						headerShown: false,
					}}
				/>

				<Stack.Screen
					name="(auth)"
					options={{
						headerShown: false,
					}}
				/>

				<Stack.Screen
					name="modal"
					options={{
						title: "Tamagui + Expo",
						presentation: "modal",
						animation: "slide_from_right",
						gestureEnabled: true,
						gestureDirection: "horizontal",
						contentStyle: {
							backgroundColor: theme.background.val,
						},
					}}
				/>
			</Stack>
		</ThemeProvider>
	);
}
