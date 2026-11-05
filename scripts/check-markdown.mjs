#!/usr/bin/env node
// فحص وثائق المشروع: (1) لا ملف Markdown يتجاوز الحد الأقصى للأسطر،
// (2) كل رابط نسبي إلى ملف .md أو صورة موجود فعلاً،
// (3) README.md يحتوي الأقسام الخمسة المطلوبة بالترتيب.
// التشغيل: npm run docs:check   (يخرج بالرمز 1 عند أي مخالفة)

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_LINES = 200
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git'])
const README_ORDER = ['# ', '## Built with', '## Screenshots', '## About the project', '## Future additions']

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []

function walk(dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else if (name.toLowerCase().endsWith('.md')) files.push(full)
  }
  return files
}

const files = walk(root)
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const rel = relative(root, file).replace(/\\/g, '/')
  const lines = text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length
  if (lines > MAX_LINES) problems.push(`${rel}: ${lines} lines (limit ${MAX_LINES})`)

  let inFence = false
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) inFence = !inFence
    if (inFence) continue
    for (const match of line.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = match[1].split('#')[0]
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue
      if (!existsSync(normalize(join(dirname(file), decodeURI(target))))) problems.push(`${rel}: broken link "${match[1]}"`)
    }
  }
}

const readmePath = join(root, 'README.md')
if (existsSync(readmePath)) {
  const headings = readFileSync(readmePath, 'utf8')
    .split('\n')
    .filter((l) => /^#{1,2} /.test(l))
  let cursor = 0
  for (const expected of README_ORDER) {
    const at = headings.findIndex((h, i) => i >= cursor && h.startsWith(expected))
    if (at === -1) problems.push(`README.md: missing or out-of-order section "${expected.trim()}"`)
    else cursor = at + 1
  }
} else {
  problems.push('README.md is missing')
}

if (problems.length > 0) {
  console.error(`docs:check found ${problems.length} problem(s):\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log(`docs:check OK: ${files.length} Markdown files, all within ${MAX_LINES} lines, links valid, README order correct.`)
