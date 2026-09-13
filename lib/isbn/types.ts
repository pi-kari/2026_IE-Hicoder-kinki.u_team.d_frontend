/**
 * ISBN から引いた書誌。型だけを置く。
 *
 * lib/isbn/ndl.ts (fast-xml-parser を import する) から切り離しているのは、
 * クライアント側がこの型を使うときにパーサまで一緒にバンドルされないようにするため。
 */
export type BookMeta = {
	isbn: string;
	title: string;
	pages: number | null;
	publisher: string | null;
	author: string | null;
	/** data URI。外部 URL は入れない (オフラインで壊れるため)。 */
	cover: string | null;
};
