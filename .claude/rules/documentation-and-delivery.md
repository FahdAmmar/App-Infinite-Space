# Documentation and delivery

## Markdown limit

- No Markdown file exceeds **200 lines**: README, `docs/`, rules, agents, skills, references, notices. The `check-markdown-length` hook flags an edit that crosses it; `npm run docs:check` checks the whole repository.
- Split at a heading boundary: a short main file plus a linked file. For a skill: `SKILL.md` plus `references/<topic>.md`, with a table in `SKILL.md` that says when to read each file.

## README.md (exactly five parts, in this order)

1. **Title** (`# InfiniteSpace`) and a one-line tagline.
2. **`## Built with`**: shields.io badges for the technologies and libraries actually in `package.json` (and Playwright for browser flows). Use the version that `package.json` declares. A badge without a Simple Icons logo is fine; do not invent a slug.
3. **`## Screenshots`**: real screenshots from `docs/screenshots/`, captured from the running app. Never mock one up. Retake the affected ones when the UI changes, and drop any that no longer match.
4. **`## About the project`**: what it is, key features (only implemented ones), how to run it, a short structure overview, and a table linking to `docs/`.
5. **`## Future additions`**: planned or possible work, clearly marked as not implemented, ordered by priority.

Everything else (architecture, security, testing evidence, limitations, shortcuts) lives in `docs/` and is linked from part 4. `npm run docs:check` verifies the section order and every relative link.

## Accuracy

- Commands, scripts, counts, and limits in docs come from the repository or from a run in the current session. Do not copy a number from an older document without checking it.
- Update docs after the final verified change, not before.
- Keep `docs/` files single-purpose: `FEATURES`, `ARCHITECTURE`, `SECURITY`, `TESTING`, `LIMITATIONS`, `CLAUDE-CODE`.

## ZIP delivery

Before handing over any `.zip`:

1. Run `/verify full` after the last edit: typecheck, lint, unit tests, build, every Playwright flow in `e2e/`, `npm audit`, `npm run docs:check`.
2. Deliver only when every command passes with no errors and the project is ready to upload. If anything fails or cannot run, say so and do not deliver.
3. Package the source, `README.md`, `docs/`, `e2e/`, `scripts/`, `.claude/`, `CLAUDE.md`, config, and the lockfile. Exclude `node_modules/`, `dist/`, `coverage/`, caches, `.git/`, `.env*`, and secrets.
4. Test the archive (`unzip -t`), read its listing, and confirm the essentials are present and no secret or dependency folder slipped in.
5. Report real results: commands run with outcomes, anything not verified, and the archive path.

## Git

Run no git command unless the user explicitly asks. Mention in the report when a git step is pending so the user can decide.
