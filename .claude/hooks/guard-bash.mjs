#!/usr/bin/env node
// PreToolUse (Bash): blocks irreversible or out-of-scope shell commands.
// Contract: reads the hook JSON from stdin; exit 2 blocks the command and
// returns stderr to Claude; exit 0 allows it. A malformed payload never blocks.

import { readFileSync } from 'node:fs'

const RULES = [
  { re: /\bgit\s+push\b[^\n;&|]*(--force\b|--force-with-lease\b|\s-f\b)/, why: 'force-push rewrites shared history' },
  { re: /\bgit\s+reset\s+--hard\b/, why: 'reset --hard discards uncommitted work' },
  { re: /\bgit\s+clean\b[^\n;&|]*\s-[a-z]*[fd]/, why: 'git clean deletes untracked files' },
  { re: /\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, why: 'discarding every working-tree change at once' },
  { re: /\bgit\s+branch\s+-D\b/, why: 'force-deleting a branch' },
  { re: /--no-verify\b/, why: 'bypassing git hooks' },
  { re: /\bnpm\s+audit\s+fix\b[^\n;&|]*--force\b/, why: 'npm audit fix --force applies breaking upgrades unreviewed' },
  { re: /\bnpm\s+(publish|unpublish|deprecate)\b/, why: 'publishing changes the public registry' },
  { re: /\brm\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*[rR][a-zA-Z]*\s+(-[a-zA-Z]+\s+)*(\/|~\/?|\$HOME\/?|\.\/?|\*|\.\.\/?|\.git\/?)(\s|$)/, why: 'recursive delete of a broad or critical path' },
  { re: /\b(curl|wget)\b[^\n;&|]*\|\s*(sudo\s+)?(sh|bash|zsh|node|python3?)\b/, why: 'piping a download into an interpreter' },
]

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    return null
  }
}

const payload = readPayload()
const command = payload?.tool_input?.command
if (typeof command !== 'string') process.exit(0)

for (const { re, why } of RULES) {
  if (re.test(command)) {
    process.stderr.write(
      `Blocked by .claude/hooks/guard-bash.mjs: ${why}.\n` +
        `Command: ${command}\n` +
        'If the user explicitly asked for this, ask them to run it themselves or to adjust the hook.\n',
    )
    process.exit(2)
  }
}
process.exit(0)
