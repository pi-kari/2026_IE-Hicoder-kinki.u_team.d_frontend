"use client";

import { AudioWaveform } from "@tamagui/lucide-icons-2/icons/AudioWaveform";
import { ClipboardPenLine } from "@tamagui/lucide-icons-2/icons/ClipboardPenLine";
import { Home } from "@tamagui/lucide-icons-2/icons/Home";
import { usePathname, useRouter } from "next/navigation";
import { XStack, YStack } from "tamagui";

/**
 * 旧 app/(tabs)/_layout.tsx の <Tabs> の置き換え。
 * React Navigation の Tabs に Next の等価物は無いので手で組む。
 *
 * 元の screenOptions を踏襲する:
 *   tabBarShowLabel: false / headerShown: false / activeTintColor: red10
 *   ただし record タブだけ green10 で、アイコンが円形に浮き上がる
 *
 * NOTE: 元の index タブには headerRight に /modal へのボタンがあったが、
 * screenOptions で headerShown: false だったため**そもそも描画されていなかった**。
 * 挙動を変えないのでここにも置かない (/modal は URL 直打ちで到達できる)。
 */
const TABS = [
	{ href: "/", Icon: Home, label: "ホーム" },
	{ href: "/record", Icon: ClipboardPenLine, label: "記録", raised: true },
	{ href: "/profile", Icon: AudioWaveform, label: "プロフィール" },
] as const;

export function TabBar() {
	const pathname = usePathname();
	const router = useRouter();

	return (
		<XStack
			position="fixed"
			b={0}
			l={0}
			r={0}
			height={56}
			items="center"
			justify="space-around"
			bg="$background"
			borderTopWidth={1}
			borderColor="$borderColor"
			// 浮き上がった record ボタンがはみ出せるようにする (元の overflow: "visible")
			style={{ overflow: "visible" }}
		>
			{TABS.map(({ href, Icon, label, ...rest }) => {
				const raised = "raised" in rest && rest.raised;
				const active = pathname === href;
				// 生の値 (theme.red10.val) ではなくトークンを渡す。
				// テーマ切り替えに追従するし、アイコンの color 型とも合う。
				const activeColor = raised ? "$green10" : "$red10";
				const color = active ? activeColor : "$gray10";

				const icon = <Icon color={color} size={raised ? 30 : undefined} />;

				return (
					<YStack
						key={href}
						items="center"
						justify="center"
						flex={1}
						height="100%"
						cursor="pointer"
						role="link"
						aria-label={label}
						aria-current={active ? "page" : undefined}
						onPress={() => router.push(href)}
					>
						{raised ? (
							<YStack
								width={64}
								height={64}
								borderWidth={3}
								borderColor="$green10"
								bg="$background"
								items="center"
								justify="center"
								style={{ borderRadius: 32, transform: "translateY(-16px)" }}
							>
								{icon}
							</YStack>
						) : (
							icon
						)}
					</YStack>
				);
			})}
		</XStack>
	);
}
