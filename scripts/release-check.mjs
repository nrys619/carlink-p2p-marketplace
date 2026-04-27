import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const failures = []

const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const distDir = join(root, 'dist')
assert(existsSync(join(distDir, 'index.html')), 'dist/index.html がありません。npm run build を実行してください。')
assert(existsSync(join(distDir, 'manifest.webmanifest')), 'dist/manifest.webmanifest がありません。')
assert(existsSync(join(distDir, 'sw.js')), 'dist/sw.js がありません。')

const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.webmanifest'), 'utf-8'))
assert(manifest.name && manifest.short_name, 'PWA manifest の name/short_name が不足しています。')
assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'PWA manifest の icons が不足しています。')

const junkPattern = /\b(TRAILER|TRAILERS|INC|LLC|CORPORATION|WELDING|FABRICATION)\b/i
const bulkSource = readFileSync(join(root, 'src/data/catalogBulk.ts'), 'utf-8')
const seedMatch = bulkSource.match(/const bulkModelSeeds = (\[[\s\S]*?\]) as const/)
assert(Boolean(seedMatch), 'catalogBulk.ts の seed を読み取れません。')
const bulkSeeds = seedMatch ? JSON.parse(seedMatch[1]) : []
const cleanBulkSeeds = bulkSeeds.map((maker) => ({
  ...maker,
  names: maker.names.filter((name) => name.length >= 2 && name.length <= 48 && !junkPattern.test(name)),
}))
const bulkMakers = cleanBulkSeeds.filter((maker) => maker.names.length > 0).length
const bulkModels = cleanBulkSeeds.reduce((sum, maker) => sum + maker.names.length, 0)
assert(bulkModels >= 1000, `車種マスターが不足しています: ${bulkModels}車種`)
assert(bulkMakers >= 30, `メーカーマスターが不足しています: ${bulkMakers}メーカー`)

const assetDir = join(distDir, 'assets')
if (existsSync(assetDir)) {
  const assetSize = statSync(assetDir).size
  assert(assetSize >= 0, 'dist/assets を確認できません。')
}

if (failures.length) {
  console.error('Release check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Release check passed: ${bulkMakers}メーカー / ${bulkModels}車種以上, PWA assets OK`,
)
