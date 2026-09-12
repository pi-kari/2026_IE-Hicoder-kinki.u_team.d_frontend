"use client";
import "./_page.css"

import "./_page.css";
import "./_page.css";
import "./_page.css";
import "./_page.css";
const _cn3 = "is_Paragraph is_Text font_body _ff-f-family _fw-f-weight-4 _ls-f-letterSpa1360334202 _fs-f-size-4 _lh-f-lineHeigh112923 _col-color _select-auto _ws-normal _text-center";
const _cn2 = "is_View _fd-row _gap-c-space-2";
const _cn = "is_View _grow-1 _shrink-1 _fb-0px _minH-100vh _items-center _justify-center";
import { Anchor, Paragraph, View, XStack } from "tamagui";
export default function ModalPage() {
  return <div className={_cn}>
			<div className={_cn2}>
				<p className={_cn3}>Made by</p>
				<Anchor color="$blue10" href="https://twitter.com/natebirdman" target="_blank">
					@natebirdman,
				</Anchor>
				<Anchor color="$color12" href="https://github.com/tamagui/tamagui" target="_blank" rel="noreferrer">
					give it a ⭐️
				</Anchor>
			</div>
		</div>;
}