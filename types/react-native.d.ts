// biome-ignore-all lint/suspicious/noExplicitAny: 型解決のためだけのスタブ。実体は無い
/**
 * react-native の「型だけ」のスタブ。実行時には何も足していない。
 *
 * このアプリは react-native をアプリの依存に持たない (bunfig.toml の
 * `[install] peer = false` で node_modules にも入らない)。
 * ところが Tamagui の一部パッケージ — @tamagui/element など — は package.json の
 * types が `./src` を指しており、**生の .ts がそのまま型検査される**。
 * その中に `import type { View } from 'react-native'` のような型 import があるため、
 * 型解決だけが失敗する (skipLibCheck は .d.ts にしか効かないので救われない)。
 *
 * ここで any のエイリアスを置くと解決する。名前は Tamagui の src が
 * 実際に import しているものを列挙したもの
 * (node_modules 配下の @tamagui 各パッケージの src を grep して収集した)。
 *
 * next.config.ts は `react-native` の alias を張っていないので、アプリのコードが
 * 実際に import すると Turbopack が「Module not found: react-native」で落とす。
 * そこが本来の防御線であって、このファイルはそれを弱めない。
 */
declare module "react-native" {
	export type View = any;
	export type ViewProps = any;
	export type ViewStyle = any;
	export type Text = any;
	export type TextStyle = any;
	export type TextInput = any;
	export type TextInputProps = any;
	export type TextInputChangeEventData = any;
	export type Image = any;
	export type ImageProps = any;
	export type ImageResizeMode = any;
	export type ScrollView = any;
	export type Switch = any;
	export type SwitchProps = any;
	export type PressableProps = any;
	export type ActivityIndicator = any;
	export type GestureResponderEvent = any;
	export type LayoutChangeEvent = any;
	export type LayoutRectangle = any;
	export type NativeSyntheticEvent<T = any> = any;
	export type InputModeOptions = any;
	export type ScaledSize = any;
	export type PanResponderGestureState = any;

	export const Alert: any;
	export const Animated: any;
	export const Appearance: any;
	export const Dimensions: any;
	export const Keyboard: any;
	export const Linking: any;
	export const PanResponder: any;
	export const PixelRatio: any;
	export const Platform: any;
	export const useWindowDimensions: any;
}
