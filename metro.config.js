// Learn more https://docs.expo.io/guides/customizing-metro
const os = require('node:os')
const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// apps/next は Next.js の API サーバで、自前の node_modules を持つ。
// Metro の projectRoot はこのリポジトリルートなので、除外しないと Next/React/pg の
// 数千ファイルをクロールし、react-native の重複解決まで起こす。
// blockList は解決だけでなくクローラにも効く
// (metro/src/node-haste/DependencyGraph/createFileMap.js が ignorePattern に渡す)。
// NOTE: 同ファイルの combine() はフラグ混在で throw するので、既定値と同じくフラグ無しにする。
const nextAppDir = path.join(__dirname, 'apps', 'next')
const escapedNextAppDir = nextAppDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
config.resolver.blockList = [
  ...config.resolver.blockList,
  new RegExp(`^${escapedNextAppDir}[\\\\/]`),
]

// Metro はデフォルトで CPU コア数ぶんのワーカープロセスを立ち上げる。
// 1 ワーカー = Node プロセス 1 つ (数百MB) なので、メモリの少ない環境では
// これだけでスワップに落ちてバンドルが極端に遅くなる。物理コアの半分・最大4に抑える。
config.maxWorkers = Math.max(2, Math.min(4, Math.floor((os.cpus().length || 4) / 2)))

module.exports = config
