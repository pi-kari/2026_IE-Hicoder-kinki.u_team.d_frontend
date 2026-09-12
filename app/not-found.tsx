"use client";

import Link from "next/link";
import { Text, View } from "tamagui";

export default function NotFound() {
	return (
		<View m={10}>
			<Text>This screen doesn't exist.</Text>
			<Link
				href="/"
				style={{ marginTop: 15, paddingTop: 15, paddingBottom: 15 }}
			>
				<Text fontSize={14} color="#2e78b7">
					Go to home screen!
				</Text>
			</Link>
		</View>
	);
}
