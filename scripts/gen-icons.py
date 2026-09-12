#!/usr/bin/env python3
"""PWA のインストールに必要な 192/512 のアイコンを生成する。

リポジトリには 48x48 の favicon しか無く、この環境には画像ライブラリも
変換ツールも入っていない。アイコンはビルド成果物ではなく普通のアセットなので、
生成して public/icons/ にコミットする (このスクリプトは作り直すときだけ使う)。

木が育つアプリなので、土台の円 + 幹 + 樹冠という最小限の図形を描く。
"""
import struct
import zlib

BG = (0xF6, 0xF3, 0xEA)      # 生成り
TRUNK = (0x8B, 0x5E, 0x3C)   # 幹
LEAF = (0x3F, 0x9A, 0x52)    # 葉
LEAF_HI = (0x62, 0xB8, 0x73)  # 葉のハイライト


def draw(size: int) -> bytes:
    s = size
    px = [[BG] * s for _ in range(s)]

    def disc(cx, cy, r, color):
        r2 = r * r
        for y in range(max(0, int(cy - r)), min(s, int(cy + r) + 1)):
            for x in range(max(0, int(cx - r)), min(s, int(cx + r) + 1)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                    px[y][x] = color

    def rect(x0, y0, x1, y1, color):
        for y in range(max(0, int(y0)), min(s, int(y1))):
            for x in range(max(0, int(x0)), min(s, int(x1))):
                px[y][x] = color

    # 幹
    rect(s * 0.455, s * 0.52, s * 0.545, s * 0.80, TRUNK)
    # 樹冠 (3 つの円を重ねる)
    disc(s * 0.50, s * 0.38, s * 0.24, LEAF)
    disc(s * 0.34, s * 0.50, s * 0.17, LEAF)
    disc(s * 0.66, s * 0.50, s * 0.17, LEAF)
    # 左上のハイライト
    disc(s * 0.42, s * 0.30, s * 0.08, LEAF_HI)
    # 地面
    rect(s * 0.22, s * 0.80, s * 0.78, s * 0.835, TRUNK)

    raw = b"".join(
        b"\x00" + b"".join(bytes(px[y][x]) for x in range(s)) for y in range(s)
    )

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", s, s, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


if __name__ == "__main__":
    import os

    os.makedirs("public/icons", exist_ok=True)
    for size in (192, 512):
        path = f"public/icons/icon-{size}.png"
        with open(path, "wb") as f:
            f.write(draw(size))
        print(f"wrote {path}")
