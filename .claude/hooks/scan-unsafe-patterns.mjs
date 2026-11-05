#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): scans the text an edit just introduced for
// constructs this project forbids. exit 2 returns stderr to Claude so it fixes the
// code; exit 0 is silent. Only application source under src/ is checked, and test
// files are skipped (they may contain hostile strings on purpose).

import { readFileSync } from 'node:fs'

const PATTERNS = [
  { re: /dangerouslySetInnerHTML/, why: 'raw HTML injection; render text through React' },
  { re: /\.(innerHTML|outerHTML)\s*=/, why: 'raw HTML injection; build nodes or use React' },
  { re: /\binsertAdjacentHTML\s*\(/, why: 'raw HTML injection' },
  { re: /\bdocument\.write\s*\(/, why: 'document.write is unsafe and blocks parsing' },
  { re: /\beval\s*\(/, why: 'eval executes arbitrary strings' },
  { re: /\bnew\s+Function\s*\(/, why: 'new Function executes arbitrary strings' },
  { re: /:\s*any\b|\bas\s+any\b|<any>/, why: 'explicit any (lint error); use a precise type or unknown plus narrowing' },
  { re: /\bfetch\s*\(\s*['"`]https?:/, why: 'app code makes no network requests (privacy model); see .claude/rules/security.md' },
  { re: /@ts-ignore/, why: '@ts-ignore hides errors; fix the type or use @ts-expect-error with a reason' },
]

let payload = null
try {
  payload = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const input = payload?.tool_input ?? {}
const path = typeof input.file_path === 'string' ? input.file_path.replace(/\\/g, '/') : ''
if (!/(^|\/)src\/.+\.(ts|tsx)$/.test(path) || /\.test\.(ts|tsx)$/.test(path)) process.exit(0)

const chunks = []
if (typeof input.content === 'string') chunks.push(input.content)
if (typeof input.new_string === 'string') chunks.push(input.new_string)
if (Array.isArray(input.edits)) {
  for (const edit of input.edits) if (typeof edit?.new_string === 'string') chunks.push(edit.new_string)
}
const text = chunks.join('\n')

const hits = []
for (const { re, why } of PATTERNS) {
  const match = re.exec(text)
  if (match) hits.push(`- "${match[0].trim()}": ${why}`)
}

if (hits.length > 0) {
  process.stderr.write(
    `.claude/hooks/scan-unsafe-patterns.mjs found forbidden constructs in the edit to ${path}:\n${hits.join('\n')}\n` +
      'Replace them (see .claude/rules/security.md and typescript-and-react.md), then continue.\n',
  )
  process.exit(2)
}
process.exit(0)
