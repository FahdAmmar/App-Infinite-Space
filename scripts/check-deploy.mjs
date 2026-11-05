// فحص جاهزية النشر على Vercel (يُشغَّل بعد `npm run build`): node scripts/check-deploy.mjs [--config <path>]
// لا يتصل بالشبكة ولا يُشغّل متصفحاً: يتحقق من إعدادات vercel.json ومن ناتج البناء، ويحاكي مطابقة المسارات والترويسات.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const configArg = process.argv.indexOf('--config')
const configPath = configArg > -1 ? process.argv[configArg + 1] : join(root, 'vercel.json')

const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && detail ? `  [${detail}]` : ''}`)
}
const read = (path) => readFileSync(path, 'utf8')

// ───── vercel.json ─────
let config
try {
  config = JSON.parse(read(configPath))
  check('vercel.json is valid JSON', true)
} catch (error) {
  check('vercel.json is valid JSON', false, String(error.message))
  process.exit(1)
}

const toRegExp = (source) => new RegExp(`^${source}$`)
const rewrites = config.rewrites ?? []
const spa = rewrites.find((rule) => rule.destination === '/index.html')
check('SPA fallback rewrite to /index.html exists', Boolean(spa))
if (spa) {
  const re = toRegExp(spa.source)
  check('deep links (/ and /w/<id>) fall back to index.html', re.test('/') && re.test('/w/abc-123'))
  check('a missing /assets/ file is NOT rewritten (stays a real 404, not HTML)', !re.test('/assets/missing-file.js'))
}

const headersFor = (path) => {
  const matched = (config.headers ?? []).filter((rule) => toRegExp(rule.source).test(path))
  return matched.flatMap((rule) => rule.headers)
}
const valueOf = (headers, key) => headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value
const keysOf = (headers) => headers.map((h) => h.key.toLowerCase())

const SAMPLE_PATHS = ['/', '/w/abc-123', '/assets/index-ABC123.js', '/favicon.svg']
for (const path of SAMPLE_PATHS) {
  const keys = keysOf(headersFor(path))
  check(`one Cache-Control at most for ${path}`, keys.filter((k) => k === 'cache-control').length <= 1)
}

const page = headersFor('/w/abc-123')
check('X-Content-Type-Options: nosniff', valueOf(page, 'X-Content-Type-Options') === 'nosniff')
check('Referrer-Policy is set', Boolean(valueOf(page, 'Referrer-Policy')))
check('X-Frame-Options: DENY', valueOf(page, 'X-Frame-Options') === 'DENY')
check('Cross-Origin-Opener-Policy is set', Boolean(valueOf(page, 'Cross-Origin-Opener-Policy')))
check('Permissions-Policy is set', Boolean(valueOf(page, 'Permissions-Policy')))
check('HTML pages are revalidated on every load', /max-age=0/.test(valueOf(page, 'Cache-Control') ?? '') && /must-revalidate/.test(valueOf(page, 'Cache-Control') ?? ''))
check('hashed assets are cached for a year as immutable', /max-age=31536000/.test(valueOf(headersFor('/assets/index-ABC123.js'), 'Cache-Control') ?? '') && /immutable/.test(valueOf(headersFor('/assets/index-ABC123.js'), 'Cache-Control') ?? ''))
check('the favicon is not marked immutable', !/immutable/.test(valueOf(headersFor('/favicon.svg'), 'Cache-Control') ?? ''))

const enforced = valueOf(page, 'Content-Security-Policy') ?? ''
for (const directive of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'"]) {
  check(`enforced CSP has ${directive}`, enforced.includes(directive))
}
const reportOnly = valueOf(page, 'Content-Security-Policy-Report-Only') ?? ''
// السياسة الكاملة تكون في Report-Only أولاً، ثم في Content-Security-Policy بعد «الترقية» (انظر docs/DEPLOYMENT.md)
const full = [reportOnly, enforced].find((policy) => policy.includes("default-src 'self'")) ?? ''
check('a full CSP is present (report-only, or enforced after promotion)', full.includes("default-src 'self'") && full.includes("script-src 'self'"))
check('the full CSP allows blob: images (cards show stored pictures)', /img-src[^;]*blob:/.test(full))
check("the full CSP has no 'unsafe-eval' and no wildcard script source", !/unsafe-eval/.test(full) && !/script-src[^;]*\*/.test(full))

// ───── ناتج البناء ─────
const dist = join(root, 'dist')
const indexPath = join(dist, 'index.html')
if (!existsSync(indexPath)) {
  check('dist/index.html exists (run `npm run build` first)', false)
} else {
  check('dist/index.html exists', true)
  // المتصفح يوحّد نهايات الأسطر إلى LF قبل حساب بصمة CSP؛ نفعل مثله كي لا تختلف النتيجة بين ويندوز ولينكس
  const html = read(indexPath).replace(/\r\n/g, '\n')
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`)
  const scriptSrc = (full.match(/script-src([^;]*)/)?.[1] ?? '').trim().split(/\s+/)
  const listed = scriptSrc.filter((token) => token.startsWith("'sha256-"))
  check(`every inline script has its hash in the CSP (${inline.length} found)`, inline.every((hash) => listed.includes(hash)), `expected ${inline.join(' ')}`)
  check('the CSP lists no stale script hash', listed.every((hash) => inline.includes(hash)), `listed ${listed.join(' ')}`)
  check('no inline event handlers in index.html', !/\son[a-z]+\s*=/.test(html))
  check('index.html loads only same-origin files', ![...html.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g)].length)

  const assets = join(dist, 'assets')
  const scripts = existsSync(assets) ? readdirSync(assets).filter((f) => f.endsWith('.js')) : []
  check('build produced JavaScript assets', scripts.length > 0)
  const offenders = scripts.filter((f) => /\beval\(|new Function\(/.test(read(join(assets, f))))
  check('no eval() or new Function() in the bundle (a strict CSP stays possible)', offenders.length === 0, offenders.join(', '))
  check('fonts are bundled locally (no external font host)', !/fonts\.(googleapis|gstatic)\.com/.test(read(indexPath)) && readdirSync(assets).some((f) => f.endsWith('.woff2')))
}

// ───── المشروع ─────
const pkg = JSON.parse(read(join(root, 'package.json')))
check('package.json declares a Node range (engines.node)', Boolean(pkg.engines?.node))
check('package.json has a build script', Boolean(pkg.scripts?.build))
check('package-lock.json is present (npm ci needs it)', existsSync(join(root, 'package-lock.json')))
check('no .env file in the project', !existsSync(join(root, '.env')))
check('.gitignore ignores .env', /^\.env$/m.test(existsSync(join(root, '.gitignore')) ? read(join(root, '.gitignore')) : ''))

const failed = results.filter((ok) => !ok).length
console.log(failed === 0 ? `\ndeploy:check OK: ${results.length} checks passed.` : `\ndeploy:check FAILED: ${failed} of ${results.length} checks failed.`)
process.exit(failed === 0 ? 0 : 1)
