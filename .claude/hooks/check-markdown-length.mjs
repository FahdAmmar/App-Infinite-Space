#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): a Markdown file may not exceed 200 lines.
// Reads the file as it is on disk after the edit. exit 2 returns stderr to Claude
// so it splits the file; exit 0 is silent. A malformed payload never blocks.

import { existsSync, readFileSync } from 'node:fs'

const MAX_LINES = 200

let payload = null
try {
  payload = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const path = payload?.tool_input?.file_path
if (typeof path !== 'string' || !path.toLowerCase().endsWith('.md') || !existsSync(path)) process.exit(0)
if (/(^|[\\/])node_modules[\\/]/.test(path)) process.exit(0)

const text = readFileSync(path, 'utf8')
const lines = text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length
if (lines > MAX_LINES) {
  process.stderr.write(
    `.claude/hooks/check-markdown-length.mjs: ${path} has ${lines} lines; the limit is ${MAX_LINES}.\n` +
      'Split it at a heading boundary into a short main file plus a linked file (for a skill: SKILL.md plus references/<topic>.md), then continue.\n',
  )
  process.exit(2)
}
process.exit(0)
