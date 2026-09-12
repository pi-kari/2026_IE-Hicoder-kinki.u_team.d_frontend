"use client";
import "./_page.css"

const _cn3 = "is_Paragraph is_Text font_body _ff-f-family _fw-f-weight-4 _ls-f-letterSpa1360334202 _fs-f-size-4 _lh-f-lineHeigh112923 _col-green10 _select-auto _ws-normal";
const _cn2 = "is_H2 is_Text font_heading _select-auto _col-color _ws-normal _ff-f-family _fw-f-weight-9 _ls-f-letterSpa1360334197 _fs-f-size-9 _lh-f-lineHeigh112928 _mt-0px _mr-0px _mb-0px _ml-0px";
const _cn = "is_View _fd-column _grow-1 _shrink-1 _fb-0px _items-center _justify-center _gap-c-space-4 _pt-c-space-6 _pr-c-space-6 _pb-c-space-6 _pl-c-space-6 _bg-background";
import { Home } from "@tamagui/lucide-icons-2/icons/Home";
import { Button, H2, Paragraph, YStack, useTheme } from "tamagui";
export default function SmokePage() {
  const theme = useTheme();
  return <div className={_cn}>
			<h2 className={_cn2}>Tamagui on Next.js</h2>
			<p className={_cn3}>background = {theme.background.val}</p>
			<Button icon={Home} theme="green">
				smoke
			</Button>
		</div>;
}