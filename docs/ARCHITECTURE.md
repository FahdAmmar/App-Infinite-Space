# Architecture

Technology choices, version decisions, code layout, and the design decisions behind them. Back to the [README](../README.md).

## Technology

| Area | Choice |
| --- | --- |
| UI | React 19, React Router 7 |
| Canvas | React Flow (`@xyflow/react` 12) |
| Build | Vite 8, TypeScript 6.0 (strict, `noUncheckedIndexedAccess`) |
| Styling | Tailwind CSS 4 with CSS-variable design tokens |
| State | Zustand 5 |
| Motion | GSAP 3 (dashboard, editor entry, card and save confirmations) |
| Effects | Three.js (optional dashboard background, lazy chunk), CSS effects adapted from Magic UI |
| Icons | Lucide React |
| Fonts | Syne, IBM Plex Sans, IBM Plex Mono, self-hosted via Fontsource (no third-party requests) |
| Tests | Vitest 5 + jsdom |
| Lint | ESLint 10, typescript-eslint, eslint-plugin-react-hooks 7 |

Magic UI components are copied into a project rather than installed as a package; the two used here (Magic Card, Border Beam) are rewritten as plain CSS and a small hook, and credited in the file headers (Magic UI is MIT licensed). The React Flow attribution link is kept visible, as its license asks of non-Pro users.

**Bundle sizes (gzipped, production build):** app shell 158 KB, editor 83 KB (loaded when a workspace opens), Three.js scene 131 KB (loaded only when the dashboard effect runs).

### Version decisions

Versions were rechecked against the npm registry during Phase 6, and every update inside the allowed ranges was applied (`npm update`; `npm audit --omit=dev` reports 0 vulnerabilities, see [SECURITY.md](SECURITY.md) for a development-only advisory in the linter chain). Three packages are deliberately **not** on their newest major:

- **TypeScript 6.0.3 instead of 7.0.2**: the current `typescript-eslint` (8.72) declares support for `typescript <6.1.0`, so TypeScript 7 would break linting.
- **React Router 7.18 instead of 8.5**: v8 requires Node ≥ 22.22, while Vite 8 only needs Node ≥ 20.19.
- **`@types/node` 22 instead of 26**: the types should match the Node version the project targets (22).

## Architecture

```
src/
  app/                    App shell: router, theme sync, 404 page, error boundaries (error-info, ErrorScreen, RouteErrorPage)
  components/
    ui/                   Primitives (Button, Dialog, DropdownMenu, Toaster, Logo, ...)
    layout/               Page-level visuals (dot-grid background)
    magic/                BorderBeam (adapted from Magic UI, MIT)
  features/
    workspaces/           Dashboard: cards, form dialog with the template picker, search/sort, template catalog, utils (+ tests)
      actions/            transfer-actions: export, import, recovery wired to the real stores and toasts
      components/data/    Data & backup dialog: storage meter, import, recovery copies
      effects/            Optional Three.js background (lazy), toggle, reduced-motion check (+ tests)
    canvas/               Editor
      components/         CanvasEditor, tool rail, creation dock, zoom controls,
                          selection toolbar, top bar, shortcuts dialog
        nodes/            Sticky, text, image, link, and group nodes, NodeFrame, editors, node-types
        edges/            ConnectionEdge (gradient, arrows, label), edge-types
        properties/       Node and connection property editors, form controls
      hooks/              useCanvasCommands, useCanvasShortcuts, useImagePaste, useImageUrl
      persistence/        Canvas codec (validation), autosave controller (pausable), tab-sync, loader, image cleanup, summary
      pages/              WorkspaceEditorPage
      styles/             React Flow theming, node and edge styles
      types/              Node and edge models (discriminated unions)
      uploads/            Image validation, decoding, compression (plan + encoder), intake pipeline, object-URL cache (+ tests)
      utils/              Node factory, group rules, connection rules, clipboard, arrange (align/distribute), URL and tag helpers,
                          connected-card planner, text-paste planner, command search, tag filter, toolbar placement, presentation order (+ tests)
  stores/                 workspace-store, ui-store, canvas-store, canvas-history (+ context/provider, selectors)
  services/persistence/   StorageAdapter (localStorage metadata + IndexedDB canvases), ImageStorage + IndexedDB with memory fallback (+ tests)
  services/transfer/      Export file format, import, backup salvage and restore (pure, storage injected)
  services/templates/     Builds the cards, connections and opening view of each template from the canvas card factories (lazy-loaded when a
                          workspace is created from one; the catalog of names and blurbs is in features/workspaces/templates)
  test-utils/             renderNode and click: React tests with createRoot and act, no test library
  hooks/                  useNow, useDocumentTitle, useSpotlight (Magic Card)
  lib/                    cn, id, time formatting (+ tests)
  styles/                 Tailwind entry, design tokens, themes
e2e/                      Playwright flow scripts: phases 3 to 8, the quick wins, phase 12, and the acceptance journey (Python, run by hand)
scripts/                  check-markdown.mjs (docs:check: line limit, links, README order)
.claude/ and CLAUDE.md    Claude Code setup (see CLAUDE-CODE.md)
```

### Key decisions

- **Replaceable persistence.** All storage goes through the async `StorageAdapter` interface. The app uses a hybrid: small workspace metadata (name, color, item count, preview) in `localStorage` so the dashboard paints instantly, and canvases and images in IndexedDB (asynchronous, far larger than `localStorage`'s 5 MB). If IndexedDB does not exist, canvases fall back to `localStorage`.
- **Serialized, latest-state saves.** Each save reads the store when it runs and saves run one after another, so an older save can never overwrite a newer change. This holds for the workspace list and for canvases.
- **Dirty means content, not state.** The autosave compares only what is persisted (ids, types, positions, sizes, parents, data, connections, viewport) against the last saved snapshot, by reference and in O(n) with no JSON serialization. Selection, dragging flags, and measurements are ignored, and undoing back to the saved state cancels the pending write.
- **Untrusted storage.** Everything read from storage is rebuilt field by field (`canvas-codec.ts`): types, ranges, sizes, colors, handles, parents, and link addresses are validated; damaged entries are skipped and counted; unreadable content is backed up (one stable slot per workspace) before anything can overwrite it.
- **Snapshot history.** Undo/redo stores snapshots of the node and edge arrays. The state is immutable, so a snapshot shares every unchanged node with the live state and costs only a few references. This avoids writing an inverse for every operation (a classic source of bugs). Steps are bounded by explicit transactions (drag, resize) and by merging rules, not by timers alone; a synchronous batch of store changes is one step.
- **Cleanup never guesses.** Deleting an image file is irreversible, so the cleanup only runs when it can read every workspace and canvas, ignores files younger than 24 hours (another tab may be mid-edit, or undo may need them), and never touches a file any saved canvas references.
- **One canvas store per open editor.** Opening another workspace starts from a clean state (no leakage), and the store is testable in isolation. Every node change goes through its actions, which is what makes history and saving observable in one place.
- **Load before editing.** The editor and its store are created only after the saved canvas has been read and validated, so there is no flash of an empty canvas and autosave cannot start before we know what is saved.
- **Typed node model.** `CanvasNode` is a discriminated union (`sticky | text | image | link | group`) on top of React Flow's node type; the node and edge registries are module-level constants so React Flow does not remount them. One generic `updateNodeData(id, type, patch)` action is typed per node type, so a patch for the wrong type does not compile.
- **Rules live in pure functions.** Group membership, connection validity, handle selection, URL and tag normalization, and image validation are plain functions with unit tests; components only call them. All connection paths (dragging, the Connect tool) share one validity check.
- **Group membership by center.** A card belongs to the smallest group that contains its center. It is evaluated when a drag ends, when a card is created, and when a group is resized. Positions of members are relative to the group (React Flow's `parentId`), and groups are kept first in the node array because React Flow requires parents before children.
- **Images are blobs, not strings.** Node data holds only an `imageId`; the bytes live in IndexedDB behind an `ImageStorage` interface. A reference-counted object-URL cache keeps images that scroll out of view cheap to restore and revokes the least recently used ones. If IndexedDB is unavailable, images stay in memory and the user is told once.
- **Height-less image nodes.** Image cards store a width only; CSS `aspect-ratio` derives the height, so resizing can never distort a picture.
- **Deletion is ours.** React Flow's delete key is disabled; one `removeSelection` action deletes selected cards and connections, keeps the cards of a deleted group, and removes dangling connections.
- **Local text drafts.** While editing, text lives in the editor component and is committed to the store once when editing ends. The canvas does not re-render per keystroke, and undo/redo does not record every character.
- **Shared commands.** Buttons, shortcuts, and the empty-state button call the same command functions, so they cannot drift apart.
- **Theme-aware note colors.** Sticky colors are CSS variables per theme (`--sticky-*`), so switching theme needs no extra logic and the minimap and swatches use the same values.
- **Virtualized rendering.** React Flow renders only nodes inside the viewport (`onlyRenderVisibleElements`).
- **Graceful degradation.** If browser storage is blocked, the app works in memory and says so; if it is full, saves report a clear error and the in-memory change is kept.

- **One file format for moving data.** A workspace export is a single JSON file (`format`, `version`, workspace text, canvas, images as Base64). JSON, not ZIP: it needs no compression dependency, and images are already compressed. Import reuses the canvas codec and the workspace sanitizer, so a file is treated exactly like damaged storage: it can lose items, never break the app. Orchestration (`services/transfer`) receives storage as parameters, which is what lets the rollback paths be unit-tested. Adding a workspace goes through `workspace-store.adoptWorkspaces`, which rolls the list back if saving fails.
- **Tab conflicts are detected, not merged.** Autosave writes the whole canvas, so two tabs would silently erase each other. Each tab announces content saves on a `BroadcastChannel`; a tab that hears one pauses its own autosave (a `paused` save status, no write even on leaving) until the user picks a version. No revision number is stored, so the saved data format did not change.

### A pitfall worth knowing

`cn()` uses `tailwind-merge`, which drops any class starting with `text-` that sits before another `text-*` utility (it assumes a text color). A custom class named `text-card` silently lost its border and background this way. Custom component classes must not start with a Tailwind utility prefix; `src/lib/cn.test.ts` guards this for the existing ones.

## Deployment

The build output in `dist/` is a static single-page app. Configure the host to serve `index.html` for unknown paths (a rewrite to `/index.html`), otherwise opening `/w/<id>` directly or refreshing on it returns a 404.
