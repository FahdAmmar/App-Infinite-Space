---
name: review
description: Review InfiniteSpace changes (a diff, branch, commit range, or named files) for correctness, readability, architecture, security, and performance against this project's rules, and report prioritized findings without editing code. Use when the user asks to review, audit, critique, or sanity-check code, or before merging or committing a larger change.
argument-hint: "[file paths or a description of the change to review]"
allowed-tools: Read, Grep, Glob
---

# Review

Scope: `$ARGUMENTS`. When empty, ask which files or changes to review (the files edited in this conversation are the usual answer). This skill reads and reports; it never edits files and runs no git command (use `git diff` only if the user asks for it).

The method is the five-axis review in `code-review-and-quality`. This file adds the project-specific part.

## 1. Understand the intent

Read the task, the conversation, or the description the user gave. State in one sentence what the change should do. If you cannot, ask before reviewing. **Done when** intent and affected areas are listed.

## 2. Read the change against the rules

Open the rule files for the touched areas (`.claude/rules/`). Read tests first: they show what the author believes the behavior is.

## 3. Delegate by area

For diffs that touch these areas, run the matching subagent in parallel and merge its findings:

| Diff touches | Subagent |
| --- | --- |
| New modules, store, persistence, node model, codec | `architecture-reviewer` |
| Links, images, user text, stored data, dependencies, `index.html`, network | `security-reviewer` |
| Components, dialogs, shortcuts, themes, motion, layout | `accessibility-reviewer` |

For a diff that adds or changes GSAP, CSS transitions, or reduced-motion handling, judge it against the Motion rule in `styling-and-design.md`, take exact values from `.claude/skills/review-animations/STANDARDS.md`, and tell the user `/review-animations` exists for a stricter pass (it runs only when typed).

## 4. Project-specific blockers

Flag each of these as **Blocker** when present:

- A persisted shape changed without codec validation, defaults, a `schemaVersion` decision, and hostile-input tests.
- Data read from storage, files, or URLs used without passing through the codec or a pure validator.
- Raw HTML injection constructs, `javascript:`-capable link handling, or SVG accepted as an image.
- Anything that sends data off the device, or a new external script, font, or fetch.
- Canvas mutations that bypass store actions (history, limits, and autosave are skipped).
- `nodeTypes` or `edgeTypes` created inside a component; selectors returning arrays or objects without `useShallow`.
- Per-keystroke writes to the canvas store.
- A weakened, skipped, or deleted test; a `@ts-ignore`, `any`, or lint suppression without a stated reason.
- Raw hex colors in components, or a custom class with a Tailwind utility prefix.
- A gesture-only feature with no keyboard or tap alternative; a shortcut missing the typing, editing, and dialog guards.
- A limit changed (`CANVAS_LIMITS`, `IMAGE_LIMITS`) without load-test evidence.

## 5. Check the evidence

Confirm that tests exist for the new behavior and that they would fail without the change (for one risky branch, invert the condition, run the focused test, then restore the file from a copy; report only what happened). Run the gate commands for information if the author has not (`/verify gate`), and say which results are the author's and which are yours.

## 6. Report

Order by severity. Use this shape:

```
Summary: <what the change does, one or two sentences> | Verdict: approve / approve with changes / request changes

Blocker
- path:line — problem in one sentence. Fix: <concrete restructuring or edit>.
Important
- ...
Suggestion
- ...

Verified: <checks that ran, with results>
Judged by reading only: <areas>
Not reviewed: <areas, and why>
```

Approve when the change clearly improves the codebase and follows the rules, even if it is not how you would have written it. Keep nitpicks out of Blocker and Important. Propose the restructuring that removes moving parts, not just the complaint.
