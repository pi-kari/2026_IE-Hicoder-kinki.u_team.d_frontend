import { Check, ChevronDown, ChevronUp } from "@tamagui/lucide-icons-2";
import React from "react";

import type { FontSizeTokens, SelectProps } from "tamagui";
import { Adapt, getFontSize, Select, Sheet, YStack } from "tamagui";
import { LinearGradient } from "tamagui/linear-gradient";

export type SelectItem = {
	name: string;
};

type SelectValue<T extends readonly SelectItem[]> = Lowercase<
	T[number]["name"]
>;

export function BookSelect<T extends readonly SelectItem[]>(
	props: SelectProps<SelectValue<T>> & {
		trigger?: React.ReactNode;
		items: T; // ← items を props に追加
		value?: SelectValue<T>;
		onValueChange?: (value: SelectValue<T>) => void;
	},
) {
	const { items, value, onValueChange, ...restProps } = props;

	// デフォルト値や内部ステートの型調整
	const [val, setVal] = React.useState<SelectValue<T>>(
		(value as SelectValue<T>) ??
			(items[0]?.name.toLowerCase() as SelectValue<T>),
	);

	const currentValue = value !== undefined ? value : val;
	const handleValueChange = (nextVal: string) => {
		setVal(nextVal as SelectValue<T>);
		onValueChange?.(nextVal as SelectValue<T>);
	};

	// Helper to get item label from value - used by renderValue for SSR
	const getItemLabel = (valStr: string) =>
		items.find((item) => item.name.toLowerCase() === valStr)?.name;

	return (
		<Select
			value={currentValue}
			onValueChange={handleValueChange}
			disablePreventBodyScroll
			{...restProps}
			// renderValue enables SSR support by providing the label synchronously
			renderValue={getItemLabel}
		>
			{props?.trigger || (
				<Select.Trigger
					maxWidth={220}
					iconAfter={ChevronDown}
					borderRadius="$4"
					backgroundColor="$background"
				>
					<Select.Value placeholder="Something" />
				</Select.Trigger>
			)}

			<Adapt when="maxMd" platform="touch">
				<Sheet
					native={!!props.native}
					modal
					dismissOnSnapToBottom
					transition="medium"
				>
					<Sheet.Frame>
						<Sheet.ScrollView>
							<Adapt.Contents />
						</Sheet.ScrollView>
					</Sheet.Frame>
					<Sheet.Overlay
						bg="$shadowColor"
						transition="lazy"
						enterStyle={{ opacity: 0 }}
						exitStyle={{ opacity: 0 }}
					/>
				</Sheet>
			</Adapt>

			<Select.Content>
				<Select.ScrollUpButton
					items="center"
					justify="center"
					position="relative"
					width="100%"
					height="$3"
				>
					<YStack z={10}>
						<ChevronUp size={20} />
					</YStack>
					<LinearGradient
						start={[0, 0]}
						end={[0, 1]}
						fullscreen
						colors={["$background", "transparent"]}
						rounded="$4"
					/>
				</Select.ScrollUpButton>
				<Select.Viewport
					minW={200}
					bg="$background"
					rounded="$4"
					borderWidth={1}
					borderColor="$borderColor"
				>
					<Select.Group>
						<Select.Label fontWeight="700">Books</Select.Label>
						{/* for longer lists memoizing these is useful */}
						{React.useMemo(
							() =>
								items.map((item, i) => {
									return (
										<Select.Item
											index={i}
											key={item.name}
											value={item.name.toLowerCase()}
										>
											<Select.ItemText>{item.name}</Select.ItemText>
											<Select.ItemIndicator marginLeft="auto">
												<Check size={16} />
											</Select.ItemIndicator>
										</Select.Item>
									);
								}),
							[items],
						)}
					</Select.Group>
					{/* Native gets an extra icon */}
					{props.native && (
						<YStack
							position="absolute"
							r={0}
							t={16}
							items="center"
							justify="center"
							width={"$4"}
							pointerEvents="none"
						>
							<ChevronDown
								size={getFontSize((props.size as FontSizeTokens) ?? "$true")}
							/>
						</YStack>
					)}
				</Select.Viewport>

				<Select.ScrollDownButton
					items="center"
					justify="center"
					position="relative"
					width="100%"
					height="$3"
				>
					<YStack z={10}>
						<ChevronDown size={20} />
					</YStack>
					<LinearGradient
						start={[0, 0]}
						end={[0, 1]}
						fullscreen
						colors={["transparent", "$background"]}
						rounded="$4"
					/>
				</Select.ScrollDownButton>
			</Select.Content>
		</Select>
	);
}
