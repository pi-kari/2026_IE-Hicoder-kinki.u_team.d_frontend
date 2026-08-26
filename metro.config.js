// Learn more https://docs.expo.io/guides/customizing-metro
const os = require('node:os')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Metro はデフォルトで CPU コア数ぶんのワーカープロセスを立ち上げる。
// 1 ワーカー = Node プロセス 1 つ (数百MB) なので、メモリの少ない環境では
// これだけでスワップに落ちてバンドルが極端に遅くなる。物理コアの半分・最大4に抑える。
config.maxWorkers = Math.max(2, Math.min(4, Math.floor((os.cpus().length || 4) / 2)))

module.exports = config
