"use client";

import { X } from "@tamagui/lucide-icons-2/icons/X";
// 型だけの import はコンパイル時に消えるので、ライブラリ本体は
// useEffect の動的 import まで読み込まれない。
import type { DecodeHintType as HintType } from "@zxing/library";
import { normalizeIsbn } from "lib/isbn/normalize";
import { useEffect, useRef, useState } from "react";
import { Button, H4, Paragraph, Spinner, XStack, YStack } from "tamagui";

/**
 * 本の裏のバーコードから ISBN を読む全画面オーバーレイ。
 *
 * **`@zxing/browser` を使う (純 JS)。** `barcode-detector` や `zxing-wasm` 系の
 * ポリフィルは WASM で、PGlite で踏んだ Turbopack のバンドル問題
 * (`instantiateWasm is not a function`, 本番ビルドのみ再現) を繰り返すことになる。
 * ネイティブの BarcodeDetector を優先する分岐は入れていない。iOS Safari と
 * Firefox に無いので経路が 2 本になり、片方しかテストできなくなる。
 *
 * **`Sheet` / `Dialog` は使わない。** tamagui.config.ts は defaultConfig そのままで
 * animation driver が無く、Sheet の出入りが動かない (CurrentToast.tsx に同じ話)。
 *
 * **ライブラリは useEffect の中で動的 import する。** 全ページ "use client" でも
 * Next はビルド時にプリレンダするので、モジュールスコープで触ると
 * next build の Node 側で navigator を参照して落ちる (lib/local/db.ts と同じ理由)。
 */

type Props = {
	/** 13 桁に正規化済みの ISBN が読めたとき。 */
	onDetected: (isbn13: string) => void;
	onClose: () => void;
};

type Phase =
	| { kind: "starting" }
	| { kind: "scanning" }
	| { kind: "error"; title: string; body: string };

/** カメラが使えない理由を、利用者が次に何をすればよいか分かる言葉にする。 */
function describe(error: unknown): { title: string; body: string } {
	const name =
		typeof error === "object" && error !== null && "name" in error
			? String((error as { name: unknown }).name)
			: "";

	if (name === "NotAllowedError" || name === "SecurityError") {
		return {
			title: "カメラの使用が許可されませんでした",
			body: "ブラウザの設定でこのサイトのカメラを許可すると使えます。許可しない場合は、下の ISBN 入力欄に数字を打ち込んでも登録できます。",
		};
	}
	if (name === "NotFoundError" || name === "OverconstrainedError") {
		return {
			title: "カメラが見つかりません",
			body: "この端末では読み取りができません。下の ISBN 入力欄に本の裏の 13 桁 (978 から始まる番号) を打ち込んでください。",
		};
	}
	return {
		title: "カメラを起動できませんでした",
		body: "下の ISBN 入力欄に本の裏の 13 桁 (978 から始まる番号) を打ち込んでも登録できます。",
	};
}

export function BarcodeScanner({ onDetected, onClose }: Props) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const [phase, setPhase] = useState<Phase>({ kind: "starting" });

	useEffect(() => {
		let cancelled = false;
		let stop: (() => void) | null = null;

		// React 19 の dev は effect を 2 回走らせる。1 回目の controls を
		// 必ず止めないとカメラが掴まれたままになる。
		const start = async () => {
			const video = videoRef.current;
			if (!video) return;

			// セキュアコンテキストでないと mediaDevices がそもそも無い。
			// スマホから http://192.168.x.x で開いたときにここに来る。
			if (!navigator.mediaDevices?.getUserMedia) {
				setPhase({
					kind: "error",
					title: "この接続ではカメラを使えません",
					body: "カメラは https (または localhost) でしか使えません。下の ISBN 入力欄に本の裏の 13 桁を打ち込んでください。",
				});
				return;
			}

			try {
				const [
					{ BrowserMultiFormatReader },
					{ BarcodeFormat, DecodeHintType },
				] = await Promise.all([
					import("@zxing/browser"),
					import("@zxing/library"),
				]);
				if (cancelled) return;

				// 書籍のバーコードは EAN-13。候補を絞ると誤読が減り、速くなる。
				const hints = new Map<HintType, unknown>([
					[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]],
				]);
				const reader = new BrowserMultiFormatReader(hints);

				// デバイス列挙 (decodeFromVideoDevice) は使わない。iOS は許可前の
				// label が空で、背面カメラを選べず内カメラを引いてしまう。
				const controls = await reader.decodeFromConstraints(
					{ video: { facingMode: { ideal: "environment" } } },
					video,
					(result) => {
						if (!result) return;
						// 日本の書籍バーコードは 2 段組みで、下段は 192… の
						// 分類・価格コード。normalizeIsbn がそれを弾く。
						const isbn = normalizeIsbn(result.getText());
						if (!isbn) return;
						// 連続で発火するので、最初の 1 件で止める。
						controls.stop();
						stop = null;
						onDetected(isbn);
					},
				);
				if (cancelled) {
					controls.stop();
					return;
				}
				stop = () => controls.stop();
				setPhase({ kind: "scanning" });
			} catch (error) {
				if (cancelled) return;
				console.error(error);
				setPhase({ kind: "error", ...describe(error) });
			}
		};

		void start();

		return () => {
			cancelled = true;
			stop?.();
		};
	}, [onDetected]);

	return (
		<YStack
			position="fixed"
			t={0}
			l={0}
			r={0}
			b={0}
			z={100}
			bg="$background"
			gap="$3"
		>
			<XStack
				items="center"
				justify="space-between"
				px="$3"
				py="$2"
				borderBottomWidth={1}
				borderColor="$borderColor"
			>
				<H4>バーコードを読み取る</H4>
				<Button
					size="$3"
					chromeless
					icon={X}
					aria-label="読み取りを閉じる"
					onPress={onClose}
				/>
			</XStack>

			{phase.kind === "error" ? (
				<YStack flex={1} justify="center" items="center" gap="$3" p="$6">
					<H4 text="center">{phase.title}</H4>
					<Paragraph text="center" maxWidth={420}>
						{phase.body}
					</Paragraph>
					<Button size="$4" onPress={onClose}>
						閉じて手入力する
					</Button>
				</YStack>
			) : (
				<YStack flex={1} justify="center" items="center" gap="$4" p="$4">
					{/* Tamagui のプリミティブではなく素の <video>。playsInline が
					    無いと iOS が全画面再生に切り替えてしまう。 */}
					<video
						ref={videoRef}
						playsInline
						muted
						autoPlay
						aria-label="カメラの映像"
						style={{
							width: "100%",
							maxWidth: 520,
							aspectRatio: "4 / 3",
							objectFit: "cover",
							borderRadius: 12,
							background: "#000",
						}}
					/>
					{phase.kind === "starting" ? (
						<XStack items="center" gap="$2">
							<Spinner />
							<Paragraph>カメラを起動しています…</Paragraph>
						</XStack>
					) : (
						<Paragraph text="center" maxWidth={420}>
							本の裏にある 2 段のバーコードのうち、
							<Paragraph fontWeight="700">上段 (978 から始まる方)</Paragraph>
							を枠に入れてください。
						</Paragraph>
					)}
				</YStack>
			)}
		</YStack>
	);
}
