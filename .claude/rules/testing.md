---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "e2e/**"
---

# Testing

## Unit tests (Vitest 5 + jsdom)

- Tests sit beside the code: `name.ts` and `name.test.ts`. Config is in `vite.config.ts` (`include: src/**/*.test.{ts,tsx}`, `restoreMocks: true`).
- Import from `vitest` explicitly. Name tests by behavior ("ignores blank and duplicate tags"), in English. Cover Arabic and other non-Latin input for text helpers.
- Put rules in pure functions so tests need no DOM. Test stores through the real store factory (`createCanvasStore`), one per test, to prove isolation.
- Use fake timers for debounce, retry, and maximum-wait behavior (see the autosave controller tests).
- Hostile and damaged input is part of the contract for the codec, URL helpers, image validation, and storage adapters: add a case for each new field or rule.
- A bug fix starts with a test that fails for the reported reason, then passes after the fix. Keep that test.
- Keep assertions meaningful. Never skip, `.only`, delete, or loosen a test to reach green; if a test is wrong, say why in the change.

## Browser flows (Playwright for Python, run by hand)

- Flows live in `e2e/` and run against a production build served by `vite preview`. Each script prints `PASS`/`FAIL` per check and its docstring says how to run it. `BASE_URL` selects the server (default `http://127.0.0.1:4173/`).
- Setup: `pip install playwright pillow`, then `playwright install chromium`. Accessibility checks use axe-core when `AXE_PATH` points at `axe.min.js`.
- Which flow covers what: `phase3_flows.py` (connections, images, links, groups), `phase4_persistence.py` (save, reload, undo, damaged data, cleanup; about a minute), `phase5_polish.py` (effects, reduced motion, keyboard, layouts at four widths, touch, axe), `acceptance.py` (the specification's Definition of Done as one journey), `phase6_stress.py` (large canvases and uploads; split with `SIZES`, `SKIP_UPLOADS`, `ONLY_UPLOADS`), `phase7_data_safety.py` (export, import, recovery, tab banner), `phase8_productivity.py` (copy and paste, reattach, align, layers, snap, find, phone layout), `quickwins_flows.py` (drag-to-create, text paste, command palette, image compression, tag filter), `phase12_flows.py` (presentation mode, template gallery), `phase15_ux.py` (phone layout, start menu, themes, palette, dashboard controls), `phase16_navigation.py` (focus branch, right-click menus, deep links), `phase16_share.py` (standalone viewer, search across workspaces), `phase16_snippets.py` (personal snippets), and `phone_text_flows.py` (phone width, 16px fields on touch, 3D scene gating, long and Arabic names).
- Select by role, label, or visible text. Generate image fixtures in code (the existing `make_png` helper) instead of committing binaries.
- A flow ends with zero console errors and zero page errors.
- New user-facing behavior gets a check in the flow that owns the area, or a new `e2e/<area>_flows.py` that follows the same `check()` pattern.

## Gaps to report honestly

- React component tests are few: they use `src/test-utils/render.ts` (`createRoot` plus `act`), not a testing library. In Vitest, import `RouterProvider` from `react-router`, not `react-router/dom` (a second copy of the router context breaks `useRouteError`).
- A flow that grants the clipboard permission (`phase8`, `quickwins`) tests the paste path; without that permission headless Chromium refuses the write and Ctrl/⌘+V pastes nothing. Run with `BASE_URL` for a dev server.
- No browser test runs in CI. Only Chromium has been used; Safari, Firefox, real touch devices, and screen readers are unverified.
