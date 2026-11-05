---
name: fix-issue
description: Fix a bug, regression, error message, or failing test in InfiniteSpace by reproducing it first, finding the root cause, making the smallest fix in the owning layer, and locking it with a regression test. Use whenever the user reports something broken, wrong, flaky, slow, lost on reload, or visually off, or pastes a stack trace or console error.
argument-hint: "[bug description, error text, failing test, or issue link]"
---

# Fix an issue

Report to fix: `$ARGUMENTS`. When empty, ask for the symptom and how to trigger it.

Work the steps in order. Each ends with a criterion; do not move on until it holds.

## 1. Pin down the symptom

State expected behavior, actual behavior, and the trigger in one sentence each. **Done when** you can describe the failure and how to cause it. Ask the user only if the report has no usable trigger and the code cannot reveal one.

## 2. Reproduce it red

Write the failing test before touching production code.

- Pure rule, store, codec, adapter, helper: a Vitest test beside the code (`.claude/rules/testing.md`).
- Visible only in the browser (layout, focus, gestures, theme): a check in the owning `e2e/` flow.

**Done when** the test fails for the reported reason and you have seen the failure output. If you cannot reproduce it, record what you tried and ask the user for more detail; do not guess a fix.

## 3. Find the root cause

Follow the data from the first wrong value backward to the line that produced it (method: `debugging-and-error-recovery`). Use the triage table to choose where to look first, then confirm with evidence.

| Symptom | Look first |
| --- | --- |
| Edit lost after reload or "Saved" never appears | Dirty comparison (`canvas-equality.ts`), autosave controller, codec dropping the field, schema change without validation |
| Items vanish when a canvas reopens | `CANVAS_LIMITS` enforced on read but not on creation, or codec rejecting a field |
| Every node remounts, flicker, lost focus | `nodeTypes`/`edgeTypes` created inside a component, unstable props to a `memo` node |
| Infinite render loop or "getSnapshot should be cached" | Zustand selector returning a new array or object without `useShallow` |
| Undo records every keystroke, or undo skips a step | Text written to the store per keystroke; missing `beginTransaction`/`endTransaction`; `canvas-history.ts` change classification |
| Card in the wrong group, or group move strands cards | `group-utils.ts` center rule, `reconcileMembership` not called, parent ordering in the node array |
| Connection refused or odd | `checkConnection`, `pickHandleSides`, codec edge validation |
| Image shows "unavailable" or leaks memory | `image-url-cache.ts` refcounts, `image-gc.ts` grace period, IndexedDB fallback path |
| Style missing on a custom class | Class starting with a Tailwind prefix swallowed by `cn()` |
| Wrong colors in one theme, flash on load | Raw hex instead of tokens, `index.html` theme script key out of sync with `ui-store` |
| Shortcut fires while typing, or is ignored | Guards in `useCanvasShortcuts`, `isTypingTarget`, open `dialog` |
| Focus escapes a dialog or jumps to `<body>` | `components/ui/Dialog.tsx` focus trap, missing `data-autofocus` |
| Slow pan or drag on big canvases | Per-frame React state, selector too broad, minimap on, quadratic scan (frame-drop method: `animation-performance`) |
| Fine on desktop, wrong on a phone (sticky hover, input zoom, height, notch) | Missing coarse-pointer guard, `vh` instead of `dvh`, input under 16 px, safe-area inset (checklist: `mobile-native`) |
| Text overflows, clips, or flips direction with long, Arabic, or mixed text | Flex child without `min-width: 0`, missing `dir="auto"`, fixed-width label (method: `/break-ui`, user-invoked) |

**Done when** you can say "X does Y because Z" and each competing explanation is ruled out by evidence.

## 4. Fix at the owning layer

- Smallest change that removes the cause. Reuse the canonical helper; keep Arabic comments for the why.
- No unrelated cleanup or reformatting in the same change.
- A fix that changes a persisted shape follows `state-and-persistence.md` (codec, `schemaVersion`, hostile-input tests).

**Done when** the red test is green and no existing test needed weakening.

## 5. Check the neighbors

Search for the same defect pattern elsewhere (`grep` the symbol or idiom). Fix siblings only when it is the same defect; list anything else as a follow-up.

## 6. Verify

Run `/verify ui` for anything a user can see, otherwise `/verify gate`.

## 7. Report

Root cause in two sentences; files changed; the regression test and where it lives; verification table from `/verify`; residual risk and follow-ups. Run no git command unless the user asks.
