# Hooks

Hooks are scripts the Claude Code harness runs around tool calls. They enforce rules deterministically, so the rules do not depend on the model remembering them. They are wired in `.claude/settings.json`; a script in this folder does nothing until that file references it.

All scripts are plain Node.js (ESM, no dependencies), so they behave the same on Windows, macOS, and Linux. Each reads the hook payload as JSON from stdin. Exit code `2` blocks the action and feeds stderr back to Claude; exit code `0` allows it. A malformed payload never blocks.

| Script | Event and matcher | What it enforces |
| --- | --- | --- |
| `guard-bash.mjs` | `PreToolUse` on `Bash` | Blocks force-push, `reset --hard`, `git clean`, `git checkout .`, `branch -D`, `--no-verify`, `npm audit fix --force`, `npm publish`, broad `rm -rf` targets, and `curl \| sh` style pipes |
| `protect-files.mjs` | `PreToolUse` on `Edit`, `Write`, `MultiEdit` | Blocks edits to `package-lock.json`, `.env*` (except `.env.example`), `dist/`, `coverage/`, `node_modules/`, `.git/`, and `.claude/settings*.json` |
| `scan-unsafe-patterns.mjs` | `PostToolUse` on `Edit`, `Write`, `MultiEdit` | Reports `dangerouslySetInnerHTML`, `innerHTML =`, `eval`, `new Function`, `document.write`, explicit `any`, `@ts-ignore`, and absolute-URL `fetch` in the text an edit just added under `src/` (test files are skipped) |
| `check-markdown-length.mjs` | `PostToolUse` on `Edit`, `Write`, `MultiEdit` | Reports any Markdown file over 200 lines as it is on disk after the edit, so Claude splits it |

`test-hooks.mjs` feeds each script sample payloads (blocked, allowed, Windows paths, malformed input) and checks the exit codes:

```bash
node .claude/hooks/test-hooks.mjs
```

## Git policy

The project owner's rule is that Claude runs no git command unless asked. `settings.json` sets `ask` for `Bash(git:*)`, so every git command needs approval, and `guard-bash.mjs` additionally blocks the destructive ones outright.

## Limits to know

- These are guardrails, not a sandbox. `guard-bash.mjs` matches common dangerous command shapes; a determined or unusual command can slip past. Keep Claude Code's permission prompts on for anything outside the allow list in `settings.json`.
- `scan-unsafe-patterns.mjs` checks only what an edit adds, and only with regular expressions. ESLint (`npm run lint`) and the compiler remain the authority.
- Hooks run with your user permissions. Review any change to this folder like code that executes on your machine.

## Verify they are active

Run `/hooks` inside Claude Code to see the registered hooks, and ask Claude to run `git push --force` in a scratch repository to see the block message. Hook and permission syntax can differ between Claude Code versions; if `/hooks` shows nothing, compare `settings.json` with the current Claude Code documentation.

## Changing or disabling

- Edit the `RULES`, `PROTECTED`, or `PATTERNS` arrays at the top of the script, then rerun `test-hooks.mjs` and add a case for the new behavior.
- To disable one hook, remove its entry from `.claude/settings.json`. Keep the script so it can be re-enabled.
- Personal overrides go in `.claude/settings.local.json` (git-ignored by convention), not in the shared file.
