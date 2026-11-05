---
paths:
  - "src/features/canvas/**"
  - "src/stores/**"
  - "vite.config.ts"
---

# Performance

## Principles

- Measure before and after any optimization (a Playwright script, the `e2e/phase6_stress.py` load test, or `performance.now()`); skip speculative tuning.
- Keep the editor responsive at the supported size: `CANVAS_LIMITS` (5,000 items, 10,000 connections) were set from load-test evidence. Raise them only with a new run that shows the same behavior.

## Rendering

- Only visible nodes render (`onlyRenderVisibleElements`). Keep it on.
- Subscribe narrowly: select the smallest slice a component needs; wrap array or object selections in `useShallow`.
- Node and edge components are `memo`; keep their props stable (no inline objects or functions that change every render).
- Do not put per-frame values in React state. Pointer-following effects write directly to the element (see `useSpotlight`).
- The minimap draws one SVG rect per item and was the largest per-frame cost; it starts hidden above `LARGE_CANVAS_NODES` (1,500, in `CanvasStoreProvider`).

## Algorithms

- Dirty detection, history comparison, and membership checks are linear or better and avoid JSON serialization. A quadratic scan in undo history was found by the load test and replaced; do not reintroduce one.
- Large batches (paste, multi-file upload, duplicate) are one store update and one history step.

## Bundles

- Entry shell, editor, and Three.js scene are separate chunks; the editor loads on route entry and the scene only when the dashboard effect runs. Import `three` only from `features/workspaces/effects/`. Outside `features/canvas`, only the canvas store (`stores/canvas-store.ts`, `CanvasStoreProvider.tsx`) imports `@xyflow/react`; keep that set small.
- `chunkSizeWarningLimit` in `vite.config.ts` sits just above the lazy Three.js chunk so any other growth still warns. A new warning is a finding to investigate, not a number to raise.
- Report gzipped chunk sizes from `npm run build` when a change touches dependencies; update the bundle figures in `docs/ARCHITECTURE.md` if they move materially.

## Known weak spot

- Zoomed far out with thousands of cards on screen, panning slows (no level-of-detail mode yet). New work in this area targets that case first.
