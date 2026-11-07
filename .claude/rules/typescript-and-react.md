---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# TypeScript and React

## Compiler and lint contract

- `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` are on. Indexing an array or record yields `T | undefined`; handle it explicitly.
- Lint errors: `@typescript-eslint/no-explicit-any`, `@typescript-eslint/consistent-type-imports`, plus the `react-hooks` rule set. Fix the cause; a justified exception needs a dedicated comment explaining why.
- TypeScript stays on the 6.0 line (`typescript-eslint` supports `<6.1.0`). Check "Version decisions" in `docs/ARCHITECTURE.md` before bumping TypeScript, React Router, or `@types/node`.

## Types

- Model variants as discriminated unions (`CanvasNode` is `sticky | text | image | link | checklist | shape | video | group`). Switch over the tag and finish with an exhaustiveness check so a new variant fails compilation where it is unhandled.
- Type per-variant updates through `updateNodeData(id, type, patch)` so a patch for the wrong type does not compile.
- Parse unknown input (storage, files, URLs) into typed values at the boundary; interior code receives only validated types.

## Components and hooks

- Function components with named exports (the project has no default exports). A route component is wired through the router's `Component` / `lazy` fields.
- A file that exports a component exports only components (`react-refresh` rule). Constants, registries, contexts, and style helpers live in sibling files (`node-types.ts`, `canvas-store-context.ts`, `button-styles.ts`).
- Wrap React Flow node and edge components in `memo` and keep their props stable.
- Effects clean up what they create: listeners, timers, observers, object URLs, and GSAP animations (`gsap.matchMedia()` with `mm.revert()` on cleanup).
- Keep text drafts local to the editing component and commit once when editing ends. Writing each keystroke to the store re-renders the canvas and floods undo history.
- User-entered text that may be Arabic uses `dir="auto"`.

## Comments and naming

- Comments are Arabic and explain intent, constraints, or a trap; they do not narrate the code.
- UI strings are English, short, and action-oriented. Error messages say what happened and what the user can do next.
