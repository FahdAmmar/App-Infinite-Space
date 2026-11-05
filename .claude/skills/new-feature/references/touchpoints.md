# Touchpoints

Open the section that matches the change and tick every line. Paths are relative to `src/`. Missing a line here is the usual cause of "works until reload", "missing from the dashboard preview", or "crashes on old data".

## A. New card (node) type

- `features/canvas/types/nodes.ts`: data type, the `Node<..., 'kind'>` alias, add to the `CanvasNode` union; add to `CreatableNodeKind` only if users create it from the dock (images arrive through uploads instead). `CanvasTool` follows `CreatableNodeKind`.
- `features/canvas/utils/constants.ts`: `NODE_SIZES` entry, field caps, any new limit.
- `features/canvas/utils/node-factory.ts`: factory with defaults, and duplication behavior; add a test in `node-factory.test.ts`.
- `features/canvas/components/nodes/<Kind>Node.tsx`: the component, `memo`-wrapped, built on `NodeFrame`; editors in their own files; `nodrag nopan nowheel` on interactive content.
- `features/canvas/components/nodes/node-types.ts`: one registry line (module-level constant).
- `features/canvas/persistence/canvas-codec.ts`: validate and default every field; add hostile and damaged-input tests in `canvas-codec.test.ts`.
- `features/canvas/components/properties/NodeProperties.tsx` (and `controls.tsx`): the properties UI.
- `features/canvas/components/CreationDock.tsx`, `PlacementHint.tsx`, `CanvasEditor.tsx`: creation tool, placement hint, click-to-place handling.
- `features/canvas/hooks/useCanvasShortcuts.ts` and `components/ShortcutsDialog.tsx`: shortcut, guarded like the others.
- `stores/canvas-store.ts`: only if the type needs special actions (limits, resize rules via `getResizeLimits`, duplication).
- Dashboard summary and preview: `features/canvas/persistence/workspace-summary.ts`, `features/workspaces/types/workspace.ts`, `features/workspaces/components/WorkspacePreview.tsx`, and the metadata handling in `services/persistence/local-storage-adapter.ts` (counts and preview rectangles).
- `features/canvas/styles/canvas.css` and `styles/index.css`: styles and tokens for both themes.
- Tests: factory, codec, store behavior, plus a check in `e2e/phase3_flows.py` or `acceptance.py`.
- Docs: `docs/FEATURES.md` (features, shortcuts), `docs/LIMITATIONS.md`.

## B. New field on an existing node or edge (persisted)

- Type in `types/nodes.ts` or `types/edges.ts`; default in the factory; codec validation and defaulting; `schemaVersion` decision (bump and migrate when old data cannot be read as-is); tests with old-shape and hostile input; equality in `utils/canvas-equality.ts` so dirty detection and history notice the field; properties UI; docs note.

## C. New tool or interaction mode

- `CanvasTool` in `types/nodes.ts`; `setTool` behavior in `stores/canvas-store.ts` (what it clears); tool rail or dock button (`ToolPalette.tsx`, `CreationDock.tsx`); a command in `hooks/useCanvasCommands.ts` shared by button, shortcut, and empty state; `useCanvasShortcuts.ts`; `PlacementHint.tsx`; cursor and touch alternative; `ShortcutsDialog.tsx`.

## D. New keyboard shortcut

- Add to `useCanvasShortcuts.ts` behind the typing, editing, and open-dialog guards; call a shared command; list it in `ShortcutsDialog.tsx` and in the shortcut table of `docs/FEATURES.md`; avoid browser-reserved combinations (call `preventDefault` only for combos you own).

## E. New properties-panel control

- `components/properties/NodeProperties.tsx` or `EdgeProperties.tsx`; reusable pieces in `controls.tsx`; write through a store action (one history step); label and `aria-describedby`; works at 390 px.

## F. Dashboard (workspaces) feature

- `features/workspaces/` types, `utils/` rules with tests, `stores/workspace-store.ts` action, `services/persistence/` adapter method (interface in `storage-adapter.ts`, both `local-storage-adapter.ts` and `hybrid-storage-adapter.ts`), components, empty and error states, `e2e/` coverage.

## G. New stored preference

- `stores/ui-store.ts` (persisted slice, validate on rehydrate as untrusted); if it affects first paint, mirror it in the inline script of `index.html` and keep the key `infinitespace:v1:ui` stable; tests in `ui-store.test.ts`.

## H. Export or import of a workspace

- A new trust boundary: imported files are hostile input. Reuse `canvas-codec.ts` validation; enforce `CANVAS_LIMITS`, `IMAGE_LIMITS`, and total file size before decoding; never trust file names or types; show a preview and the count of skipped items; keep it undoable or non-destructive (import creates a new workspace). Add hostile-file tests and a browser flow. Docs: format description in `docs/FEATURES.md` and limits in `docs/LIMITATIONS.md`.

## I. Anything that leaves the browser

- Stop. This changes the privacy model (`security.md`): get an explicit decision, add a Content-Security-Policy, update `docs/SECURITY.md`, and make the feature opt-in.

## Every feature

- Unit tests for rules; a browser check for visible behavior; both themes; keyboard; reduced motion; docs updated and `npm run docs:check` green; `/verify` report attached to the hand-off.
