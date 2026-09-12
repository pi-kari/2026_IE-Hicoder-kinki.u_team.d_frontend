"use client";

import "./_not-found.css"
const _cn3 = "is_Text _col-2e78b735 _fs-14px";
const _cn2 = "is_Text _col-color";
const _cn = "is_View _mt-10px _mr-10px _mb-10px _ml-10px";
import Link from "next/link";
import { Text, View } from "tamagui";
export default function NotFound() {
  return <div className={_cn}>
			<span className={_cn2}>This screen doesn't exist.</span>
			<Link href="/" style={{
      marginTop: 15,
      paddingTop: 15,
      paddingBottom: 15
    }}>
				<span className={_cn3}>
					Go to home screen!
				</span>
			</Link>
		</div>;
}