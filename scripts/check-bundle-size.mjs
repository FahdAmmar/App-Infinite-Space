// ميزانية حجم الحزم بعد البناء: تفشل إن تضخمت حزمة فوق حدّها المضغوط (gzip)، فلا يتسلل التضخم بصمت.
// التشغيل بعد `npm run build`:  npm run size:check
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const assets = join(process.cwd(), 'dist', 'assets')
if (!existsSync(assets)) {
  console.error('FAIL dist/assets is missing (run `npm run build` first)')
  process.exit(1)
}

// الحدود بالكيلوبايت المضغوط = القياس عند آخر مراجعة + هامش نحو 8%. ارفع حداً فقط بقرار واعٍ مكتوب في الـ PR.
const BUDGETS = [
  { name: 'entry chunk (dashboard first load)', match: /^index-.*\.js$/, maxKb: 160 },
  { name: 'editor chunk (lazy)', match: /^WorkspaceEditorPage-.*\.js$/, maxKb: 138 },
  { name: 'Three.js background (lazy, decorative)', match: /^createBackgroundScene-.*\.js$/, maxKb: 142 },
  { name: 'entry CSS', match: /^index-.*\.css$/, maxKb: 14 },
]
// أي حزمة JavaScript أخرى (قوالب، مصانع...) صغيرة بطبيعتها؛ تجاوز هذا الحد يعني دخول شيء ثقيل حزمة جديدة
const OTHER_MAX_KB = 30

const kb = (bytes) => bytes / 1024
let failed = 0
for (const file of readdirSync(assets).filter((f) => /\.(js|css)$/.test(f)).sort()) {
  const gz = kb(gzipSync(readFileSync(join(assets, file))).length)
  const budget = BUDGETS.find((b) => b.match.test(file))
  if (!budget && file.endsWith('.css')) continue
  const limit = budget?.maxKb ?? OTHER_MAX_KB
  const ok = gz <= limit
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${(budget?.name ?? 'other chunk').padEnd(42)} ${file.padEnd(44)} ${gz.toFixed(1)} KB gzip (limit ${limit})`)
}
if (failed > 0) {
  console.error(`\n${failed} chunk(s) over budget.`)
  process.exit(1)
}
console.log('\nAll chunks within budget.')
