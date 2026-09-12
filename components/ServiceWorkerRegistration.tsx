"use client";

import { useEffect } from "react";

/**
 * Service Worker を登録する。
 *
 * これが無いと、端末内 DB があってもオフラインでは**ページ自体が開けない**
 * (ブラウザのエラー画面越しにローカル DB へは到達できない)。
 * 「オフラインファースト」を名乗れるかどうかはここに懸かっている。
 *
 * 本体は public/sw.js (scripts/gen-sw.ts が生成)。
 * 開発中は登録しない。キャッシュが HMR と噛み合わず、変更が反映されない
 * ように見えて原因を追いにくくなるため。
 */
export function ServiceWorkerRegistration() {
	useEffect(() => {
		if (process.env.NODE_ENV !== "production") return;
		if (!("serviceWorker" in navigator)) return;

		navigator.serviceWorker.register("/sw.js").catch((error) => {
			// 登録に失敗してもオンラインでは普通に動く。オフラインが効かないだけ。
			console.warn("Service Worker の登録に失敗しました", error);
		});
	}, []);

	return null;
}
