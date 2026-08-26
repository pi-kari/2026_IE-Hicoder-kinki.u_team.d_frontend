import { Stack } from "expo-router";

export default function MainPagesLayout() {
	return (
		<Stack>
			<Stack.Screen
				name="books"
				options={{
					title: "書籍一覧",
				}}
			/>
			<Stack.Screen
				name="books-information"
				options={{
					title: "書籍情報を登録",
				}}
			/>
		</Stack>
	);
}
