// يشغّل كل فحوصات المتصفح (e2e/*.py) بأمر واحد: يبني، يشغّل المعاينة، ينفذ كل سكربت بالتسلسل، ثم يطفئ المعاينة.
//   npm run e2e                 كل السكربتات
//   npm run e2e -- phase15      السكربتات التي يحوي اسمها هذه الكلمة
// يتطلب Python مع playwright وChromium:  pip install playwright && playwright install chromium
import { spawn, spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const PORT = process.env.E2E_PORT ?? '4173'
const BASE_URL = `http://127.0.0.1:${PORT}/`
const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const filter = process.argv[2]
// سكربت التقاط الصور يولّد ملفات للتوثيق ولا يفحص شيئاً
const SKIP = new Set(['capture_screenshots_phase16.py'])

const scripts = readdirSync('e2e').filter((f) => f.endsWith('.py') && !f.startsWith('_') && !SKIP.has(f) && (!filter || f.includes(filter))).sort()
if (scripts.length === 0) {
  console.error('No e2e scripts match.')
  process.exit(1)
}

const build = spawnSync(npm, ['run', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' })
if (build.status !== 0) process.exit(build.status ?? 1)

const preview = spawn(npx, ['vite', 'preview', '--port', PORT, '--strictPort', '--host', '127.0.0.1'], {
  stdio: 'ignore',
  shell: process.platform === 'win32',
})
const stop = () => preview.kill()
process.on('exit', stop)

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE_URL)).ok) return
    } catch {
      /* الخادم لم يبدأ بعد */
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`preview did not start on ${BASE_URL}`)
}

let failures = 0
try {
  await waitForServer()
  for (const script of scripts) {
    const started = Date.now()
    const run = spawnSync(python, [`e2e/${script}`], { env: { ...process.env, BASE_URL }, encoding: 'utf8' })
    const out = `${run.stdout ?? ''}${run.stderr ?? ''}`
    const failedChecks = out.split('\n').filter((line) => line.startsWith('FAIL'))
    const ok = run.status === 0 && failedChecks.length === 0
    if (!ok) {
      failures++
      console.log(out.split('\n').slice(-25).join('\n'))
    }
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${script}  (${((Date.now() - started) / 1000).toFixed(0)} s)`)
  }
} finally {
  stop()
}
console.log(failures === 0 ? `\nAll ${scripts.length} browser flows passed.` : `\n${failures} of ${scripts.length} browser flows failed.`)
process.exit(failures === 0 ? 0 : 1)
