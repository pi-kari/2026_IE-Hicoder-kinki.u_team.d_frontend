#!/usr/bin/env bash
# PGlite の ESM 実体を public/pglite/ へコピーする。
#
# なぜバンドルせず public から配るのか:
#   Turbopack は @electric-sql/pglite をバンドルするとスコープホイスティング時に
#   識別子を衝突させ、initdb 内のローカル変数が名前空間参照を覆い隠して
#   「TypeError: <x>.instantiateWasm is not a function」で実行時に落ちる。
#   dev では再現せず本番ビルドでのみ発生する。experimental.turbopackMinify: false
#   でも直らない (= ミニファイアではなくモジュール併合の問題)。
#   public/ から素の ESM を配り turbopackIgnore で読むとバンドラを一切通らない。
set -euo pipefail
SRC="node_modules/@electric-sql/pglite/dist"
DST="public/pglite"

rm -rf "$DST"
mkdir -p "$DST"
cp "$SRC"/index.js "$SRC"/chunk-*.js "$SRC"/initdb.js "$SRC"/pglite.js "$DST"/
cp "$SRC"/initdb.wasm "$SRC"/pglite.wasm "$SRC"/pglite.data "$DST"/
echo "copied $(ls -1 "$DST" | wc -l) files to $DST ($(du -sh "$DST" | cut -f1))"
