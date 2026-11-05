# Working with Claude Code

The repository carries a Claude Code setup so every session starts from the project's conventions and ends with a verification routine. Back to the [README](../README.md).

## Layout

```
CLAUDE.md          Short project guide, loaded automatically
.claude/
  settings.json    Shared permissions (git always asks) and hook wiring
  rules/           Conventions by area: architecture, TypeScript and React, state and
                   persistence, canvas and nodes, styling, security, testing,
                   accessibility and motion, performance, documentation and delivery
  agents/          frontend-engineer, architecture-reviewer, security-reviewer,
                   test-engineer, accessibility-reviewer
  hooks/           Node scripts that block destructive commands, protect generated files,
                   flag unsafe code, and keep Markdown files within 200 lines
  references/      Shared checklists used by the imported skills
  skills/          /new-feature, /fix-issue, /review, /verify, plus twelve imported skills
scripts/check-markdown.mjs   Backs `npm run docs:check`
```

## Standing rules

1. Run no git command unless explicitly asked.
2. Every Markdown file stays within 200 lines (`npm run docs:check`).
3. A ZIP is delivered only after `/verify full` passes with no errors and the project is ready to upload.
4. `README.md` keeps its five parts in order: title, badges, screenshots, explanation, future additions.

## Workflows

| Command | Purpose |
| --- | --- |
| `/new-feature <description>` | Plan against the rules, slice the work, build test-first, update the docs |
| `/fix-issue <symptom>` | Reproduce with a failing test, find the root cause, fix in the owning layer, keep the test |
| `/review [files]` | Review without editing; findings ordered by severity |
| `/verify [gate\|ui\|full]` | Run the checks that match the change and report real results; `full` before any ZIP |
| `/break-ui <target>` | Push a component through worst-case data (long, Arabic, empty, huge); report first, fix on request. Runs only when typed |
| `/review-animations [files]` | Strict motion review against the project's motion rules. Runs only when typed |

Two more skills load on their own when the work calls for them: `animation-performance` (frame drops, drag and pan cost) and `mobile-native` (phone and touch fixes at 390 px).

## Subagents

`frontend-engineer` implements. `architecture-reviewer`, `security-reviewer`, and `accessibility-reviewer` review without editing. `test-engineer` writes unit tests and Playwright flows. The `/review` skill chooses among them by the area a change touches.

## Hooks

| Script | Event | Effect |
| --- | --- | --- |
| `guard-bash.mjs` | Before `Bash` | Blocks force-push, hard reset, broad `rm -rf`, `npm publish`, and similar |
| `protect-files.mjs` | Before edits | Blocks the lockfile, `.env*`, `dist/`, `.git/`, and `.claude/settings*.json` |
| `scan-unsafe-patterns.mjs` | After edits | Flags raw HTML injection, `eval`, `any`, `@ts-ignore`, and absolute-URL `fetch` in `src/` |
| `check-markdown-length.mjs` | After edits | Flags any Markdown file over 200 lines |

Details and limits are in `.claude/hooks/README.md`. Test them with `node .claude/hooks/test-hooks.mjs`.

## Optional plugins (not bundled)

Two official plugins from `claude-plugins-official` suit this project but are not vendored here, because they are plugins (hooks and tool configuration), not skills, and the project ZIP should not carry hooks that run code on a recipient's machine. Install them yourself, per user, if you want them. Neither has been run against this repository.

| Plugin | What it adds | Before you enable it |
| --- | --- | --- |
| `typescript-lsp` | Go-to-definition, find-references, and diagnostics through a TypeScript language server | `npm install -g typescript-language-server typescript`, then `/plugin install typescript-lsp@claude-plugins-official`. Confirm it picks the project's TypeScript 6 |
| `security-guidance` | Pattern warnings on edits, plus an LLM diff review after each turn | Needs Claude Code 2.1.144 or newer and Python 3.8+. Each review sends changed paths, diffs, and file contents to your model endpoint and costs tokens. Its pattern layer overlaps `scan-unsafe-patterns.mjs`. Its commit and push reviews only fire when you ask for a git step |

Impeccable was also reviewed and is not recommended here: its hooks download and run a native engine on every edit, and its design-director workflow targets new surfaces, not a reference-driven app.

## Notes

- Hook and permission syntax depends on the installed Claude Code version. Run `/hooks` and `/permissions` to confirm what is active.
- Personal overrides go in `.claude/settings.local.json`, which is git-ignored.
- Third-party skills, their sources, licenses, and the changes made to them are listed in `.claude/skills/THIRD_PARTY_NOTICES.md`.
