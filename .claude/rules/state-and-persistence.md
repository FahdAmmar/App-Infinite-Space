---
paths:
  - "src/stores/**"
  - "src/services/**"
  - "src/features/*/persistence/**"
  - "src/features/canvas/types/**"
---

# State and persistence

## Stores

- `workspace-store` (dashboard list), `ui-store` (theme, sort, effects; persisted under `infinitespace:v1:ui`), and a **per-editor canvas store** created by `createCanvasStore` and provided through `CanvasStoreProvider`. Read it with `useCanvasStore(selector)`; use `useCanvasStoreApi().getState()` inside event handlers when no subscription is needed.
- Change canvas data only through store actions. Direct `setState` from components bypasses history, limits, and autosave.
- Selectors return primitives or stable references. Arrays and objects need `useShallow` at the call site. Put shared selectors in `canvas-selectors.ts`.
- Deletion goes through `removeSelection` (React Flow's own delete key is disabled). It keeps the cards of a deleted group and removes dangling connections.
- Creation paths (add, duplicate, connect) enforce `CANVAS_LIMITS`; reading enforces them again. Both sides must agree or items vanish on reopen.

## Undo and redo

- History stores immutable snapshots of the node and edge arrays (`canvas-history.ts`, limit `HISTORY_LIMIT`). Unchanged nodes are shared, so a snapshot costs references, not copies.
- A synchronous batch of store changes is one step. Wrap multi-event gestures (drag, resize) in `beginTransaction()` / `endTransaction()`.
- Steps are classified (`move`, `create`, `content`, `edit`) and merged by rule: repeated moves within `MOVE_COALESCE_MS` become one step, and creating a card then typing its first text is one step. A new kind of change needs a deliberate classification and a test in `canvas-history.test.ts`.
- History and dirty detection compare content (`canvas-equality.ts`); selection, dragging flags, and measurements do not count. Restoring a snapshot clears selection.

## Saving

- The autosave controller (`canvas-persistence.ts`) debounces (`SAVE_DEBOUNCE_MS`), caps waiting (`SAVE_MAX_WAIT_MS`), and runs saves one after another, each reading the latest store state when it runs.
- "Dirty" means persisted content differs from the last saved snapshot (`canvas-equality.ts`, reference comparison, O(n), no JSON). Undoing back to the saved state cancels the pending write.
- Quota or I/O failures surface through `SaveStatus` with a retry; the in-memory change is kept.
- `setPaused(true)` stops every write, including the flush when the editor closes. `CanvasPersistenceProvider` uses it when another tab saved the workspace (`tab-sync.ts`); only a content change is announced, not pan or zoom.
- New workspaces from import or restore go through `workspace-store.adoptWorkspaces`, which rolls the list back when saving fails. Write the canvas first, then adopt, and undo the canvas and images if adopting fails.

## Stored data is untrusted

- `canvas-codec.ts` rebuilds every field read from storage: types, ranges, sizes, colors, handles, parents, and link addresses. Damaged items are skipped and counted; unreadable content is backed up (one slot per workspace) before anything can overwrite it.
- **Changing a persisted shape** (a new node field, a renamed key, a new edge option) requires all of: the type in `types/`, validation and defaulting in the codec, a decision on `schemaVersion` (bump and migrate when old data cannot be read as-is), codec tests with old-shape and hostile input, and a note in `docs/LIMITATIONS.md` if users are affected.
- Storage keys use the `infinitespace:v1:` prefix. A key rename is a migration.

## Images

- Node data holds an `imageId`; bytes live in IndexedDB behind `ImageStorage`. Components resolve ids to `blob:` URLs through the reference-counted cache (`image-url-cache.ts`) and release them on unmount.
- Cleanup (`image-gc.ts`) runs only when it can read every workspace and canvas, ignores files younger than `IMAGE_ORPHAN_GRACE_MS`, and never removes a referenced file. Deletion is irreversible, so any change here needs tests for the "cannot read everything" path.
