---
name: verify
description: Prove InfiniteSpace work with evidence before calling it done, fixed, passing, or ready to upload. Use after any change under src/, whenever the user asks to check, test, validate, or confirm the project, and always before delivering a ZIP. Runs typecheck, lint, unit tests, build, the Playwright flows, npm audit, and the docs check, then reports the real results and what stayed unverified.
argument-hint: "[gate | ui | full]"
allowed-tools: Bash(npm run typecheck), Bash(npm run lint), Bash(npm run test), Bash(npm run build), Bash(npm run docs:check), Bash(npm run deploy:check), Bash(npm audit), Bash(node .claude/hooks/test-hooks.mjs)
---

# Verify

Evidence before assertions: report only what ran after the last change, with the real output. Level requested: `$ARGUMENTS`. When empty, choose from the table. Run no git command; use file listings instead.

## 1. Choose the level

| Level | Use when | Runs |
| --- | --- | --- |
| `gate` | Changes limited to utils, stores, types, tests, config | The gate commands |
| `ui` | Anything a user sees or does (components, CSS, shortcuts, persistence behavior) | Gate + the browser flows for the touched area |
| `full` | **Before any ZIP**, a release, or a phase hand-off | Gate + every flow + `npm audit` + hygiene checks |

A ZIP is never delivered on a lower level. Docs-only or `.claude/`-only changes still need `npm run docs:check`; run `node .claude/hooks/test-hooks.mjs` if hooks changed.

## 2. Gate (always, in this order)

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run docs:check
```

- `npm test` and `npm run test` are the same script (`vitest run`); run it once.
- Stop at the first failure, fix it, rerun that command, then rerun the rest of the gate.
- Quote the real counts ("Tests 326 passed (326)"), never numbers copied from a document.
- A build warning is a result. Report it, and investigate any new chunk-size warning (`performance.md`).

## 3. Browser flows (`ui` and `full`)

Setup once per machine: `pip install playwright pillow`, then `playwright install chromium`. Build first, then serve the production build and run a flow against it. The helper from the `webapp-testing` skill starts and stops the server:

```bash
python .claude/skills/webapp-testing/scripts/with_server.py \
  --server "npx vite preview --port 4173 --host 127.0.0.1" --port 4173 \
  -- python e2e/acceptance.py
```

Use `python3` where `python` is not Python 3. Flows read `BASE_URL` (default `http://127.0.0.1:4173/`) and print `PASS`/`FAIL` per check.

| Changed area | Flow |
| --- | --- |
| Connections, images, links, groups, properties panel | `e2e/phase3_flows.py` |
| Persistence, codec, undo/redo, autosave, adapters, dashboard summaries | `e2e/phase4_persistence.py` (about a minute) |
| Animation, effects, themes, layout, focus, dialogs, shortcuts, accessibility | `e2e/phase5_polish.py` (axe runs when `AXE_PATH` points at `axe.min.js`) |
| Data safety (export, import, recovery, tab banner) | `e2e/phase7_data_safety.py` |
| Copy and paste, reattaching, align, layers, snap, find, phone layout | `e2e/phase8_productivity.py` |
| Drag-to-create, text paste, command palette, image compression, tag filter | `e2e/quickwins_flows.py` |
| Presentation mode, template gallery | `e2e/phase12_flows.py` |
| Phone layout, start menu, themes, command palette, dashboard controls | `e2e/phase15_ux.py` |
| Focus on a branch, right-click menus, deep links | `e2e/phase16_navigation.py` |
| Standalone read-only viewer export, search across workspaces | `e2e/phase16_share.py` |
| Personal snippets (save, insert elsewhere, delete, survive reload) | `e2e/phase16_snippets.py` |
| Phone width, 16px fields on touch, 3D scene gating, long and Arabic names | `e2e/phone_text_flows.py` |
| Any user-facing behavior | `e2e/acceptance.py` |
| Item limits, rendering, minimap, large canvases | `e2e/phase6_stress.py` (long; narrow with `SIZES`, `SKIP_UPLOADS`, `ONLY_UPLOADS`) |

`e2e/capture_screenshots_phase16.py` retakes README screenshots; it is not a check, so run it only when the UI changed and the screenshots must be refreshed. At `full` level, run every flow listed above (each `e2e/*.py` except the capture script); a new flow added to `e2e/` also belongs in this table.

If a browser cannot run, say the flows were not run and why. Reading code is not a substitute.

## 4. Full level: delivery gate

All of these must hold before a ZIP is handed over:

1. Every gate command exits 0; every flow ends with zero `FAIL` and zero console errors.
2. `npm audit` is reported (no `--force` fixes); any finding is stated with its severity.
3. `npm run docs:check` passes: every Markdown file within 200 lines, links valid, README in the five-part order. `npm run deploy:check` passes against the fresh build (Vercel config and output; it needs `dist/`, so run it after `npm run build`).
4. Hygiene: no `.env*`, `dist/`, `node_modules/`, or stray files in what will be packaged; the lockfile is included; no secrets in `.claude/`, `docs/`, or source.
5. Everything above ran **after the final edit**. Any later edit means rerunning the affected checks and the gate.
6. After zipping: `unzip -t` is clean and the listing shows the expected files only.

If any item fails or cannot run, do not deliver: report what failed and what you did about it.

## 5. When something fails

1. Capture the failing output.
2. Classify it: caused by this change, present before it (reason from the files you touched), or environmental (missing browser, busy port).
3. Fix what this change broke; rerun the failing check, then the gate.
4. Leave scripts, thresholds, and assertions as they are. Never skip, loosen, or delete a check to get green.

## 6. Report

```
Verification (level: <gate|ui|full>)
| Check | Command | Result |
| one row per command actually run, with real counts or exit status |

Not verified: <flows not run and why; Safari/Firefox; real touch devices; screen readers>
Failures or warnings: <exact, or "none">
Ready to upload: <yes, with the evidence above | no, with the blocker>
```

State "verified" only for rows that passed after the final edit. If a critical check did not run or failed, the work is not fully verified.
