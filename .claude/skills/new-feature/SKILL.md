---
name: new-feature
description: Plan and build a new InfiniteSpace capability (a card type, tool, shortcut, panel control, dashboard feature, export/import, or UX improvement) in thin verified slices with tests, accessibility, both themes, and docs. Use whenever the user asks to add, build, implement, extend, or improve a feature or behavior in the app.
argument-hint: "[feature description]"
---

# New feature

Feature request: `$ARGUMENTS`. When empty, ask what the user wants to be able to do.

Each step ends with a criterion; do not move on until it holds. Related skills: `incremental-implementation` (slicing), `test-driven-development` (red-green), `frontend-ui-engineering` (UI quality), `security-and-hardening` (inputs), `mobile-native` (touch and phone layout), `animation-performance` (any motion).

## 1. Ground it

Read `CLAUDE.md`, the rules for the areas the feature touches, `docs/FEATURES.md` (status), `docs/LIMITATIONS.md`, and README "Future additions" (the request may already be listed, or may collide with a documented limit). **Done when** you know which rules apply and whether the feature is new, planned, or a known limitation.

## 2. Define "done"

Write three to six acceptance criteria as observable user behavior ("Dragging a connection end onto another card reattaches it and one undo restores it"). Include the empty, error, and limit cases. Ask the user only when an open question affects persisted data, privacy (anything that leaves the browser), or the scope of a major design choice; otherwise choose the reversible option and state the assumption.

**Done when** each criterion can be checked by a test or a browser flow.

## 3. Design on paper first

Answer these in a short note (in the reply for small features; in `docs/` only if the user wants a design record):

- **Where does it live?** Use `references/touchpoints.md` to list every file the change must touch.
- **Does it change persisted data?** If yes: type, codec validation and defaults, `schemaVersion` decision, hostile-input tests, docs note.
- **Which limits and caps apply?** Add constants beside the existing ones.
- **Undo:** which history step does it produce (`move`, `create`, `content`, `edit`), and does it need a transaction?
- **Input safety:** every new text, URL, or file input goes through a pure validation function.
- **Interaction:** keyboard path, shortcut and `ShortcutsDialog` entry, touch alternative, focus handling.
- **Visual:** token colors, both themes, reduced motion, 390 px width.
- **Privacy:** does anything leave the browser? If so, stop and get the user's decision (`security.md`).

**Done when** the touchpoint list is written and every item above has an answer or "not affected".

## 4. Slice it

Cut the work into vertical slices of roughly one reviewable change each (about 100 to 300 changed lines), ordered so the app works after every slice: pure rules and types first, then store actions, then UI, then polish. Do not mix refactoring with new behavior.

## 5. Build each slice red, green, check

For every slice: write the failing unit test for the rule or action, make it pass with the smallest implementation, run `npm run typecheck` and the focused test, then move on. Reuse existing helpers and components. Comments in Arabic explain why.

**Done when** the slice's tests pass and the app still builds.

## 6. Finish the experience

After the logic works, cover what makes it shippable: empty, loading, disabled, and error states with readable messages; keyboard and focus behavior; labels and live announcements; dark and light themes; reduced motion; touch targets; responsive widths. Delegate review to the `accessibility-reviewer` subagent for UI-heavy work and to `security-reviewer` when the feature handles input or storage. For UI that shows user text (names, tags, link titles), tell the user `/break-ui` is available for a worst-case-data pass; it runs only when typed.

## 7. Document

Update the docs that changed (`docs/FEATURES.md` for features and shortcuts, `docs/LIMITATIONS.md`, `docs/ARCHITECTURE.md` for decisions) mark the feature ✅ in the roadmap `features.md` (only once it is implemented and its automated checks pass), and move finished items out of README "Future additions". Keep every Markdown file within 200 lines; do not invent capabilities or results.

## 8. Verify and report

Run `/verify ui` (or `/verify full` when the change is large or touches persistence). Report: acceptance criteria with the evidence for each, files changed, tests added, checks run with real outcomes, what was not verified, and follow-ups. Run no git command, and create no ZIP, unless the user asks; a ZIP requires `/verify full` first.
