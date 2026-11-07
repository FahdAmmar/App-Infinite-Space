---
paths:
  - "src/features/canvas/**"
---

# Canvas, nodes, and connections

## Model

- `CanvasNode` is a discriminated union: `sticky | text | image | link | checklist | shape | video | group`, layered on React Flow's node type. `CanvasEdge` carries `CanvasEdgeData` (color, dashed or dotted, arrows, label).
- Sizes, limits, and field caps live in `utils/constants.ts` (`NODE_SIZES`, `IMAGE_LIMITS`, `CANVAS_LIMITS`, `MAX_FILES_PER_DROP`, length and tag caps). Change a number there, never as a literal in a component.
- `CreatableNodeKind` excludes `image`: images enter only through the upload pipeline (`uploads/`), which validates before a node exists.
- Node and edge data are immutable. Produce new objects; never mutate a node in place.

## Adding or changing a node type

Walk the touchpoint list in `.claude/skills/new-feature/references/touchpoints.md`. The registry line in `node-types.ts` is the easy part; the codec, properties panel, dashboard preview, and tests are the ones that get forgotten.

## React Flow behaviors that shape the code

- `nodeTypes` and `edgeTypes` are module-level constants. Node components are wrapped in `memo`.
- React Flow's delete key is disabled; deletion is the store's `removeSelection`.
- `onlyRenderVisibleElements` is on. Keep it on; it is why 5,000-item canvases stay usable.
- Interactive content inside a node carries `nodrag nopan` (and `nowheel` for scrollable text) so selecting text does not move the card or zoom the canvas.
- Parents come before children in the node array. Groups stay first; member positions are relative to the group (`parentId`).
- Image nodes store a width only. CSS `aspect-ratio` derives the height, so resizing cannot distort a picture.

## Groups

- A card belongs to the smallest group that contains its **center**. Membership is re-evaluated when a drag ends, when a card is created, and when a group is resized (`reconcileMembership`, `reconcileAllMembership`).
- Groups cannot be nested or connected. Deleting a group keeps its cards.
- The rules are pure functions in `utils/group-utils.ts`; change behavior there with tests.

## Connections

- One validity function, `checkConnection` (`utils/edge-utils.ts`), serves dragging, the Connect tool, and "Connect to…". A new way to connect calls it too.
- Duplicate and self connections are rejected with a readable reason, not silently.
- `reconnectEdge` excludes the edge being moved from the duplicate check (so an end can move to another side of the same card), and `CanvasEditor` keeps the dragged edge id in a ref for `isValidConnection` for the same reason.
- Handle sides are picked by `pickHandleSides`; saved edges are validated against existing nodes by the codec.

## Clipboard and arranging

- Copy, paste, align, and distribute are pure functions (`utils/clipboard.ts`, `utils/arrange.ts`); the store only applies the result (`pasteItems`, `moveNodes`), each in one `set`, so each is one undo step. Tests that chain edits must `await Promise.resolve()` between them, because history merges changes made in the same tick.
- Layer order is the node array order (`utils/layers.ts`); it is saved as is, and groups stay first. Search rules live in `utils/find.ts`; the find bar mounts its work only while open.
- The clipboard is module memory, not the system clipboard. A selected card whose group is not copied becomes absolute and parentless; members of a copied group keep relative positions.

## Interaction contract

- Tools: `select`, `hand`, `connect`, plus creation tools. `startEditing` returns to `select`.
- A text edit commits once, when editing ends; the store holds no per-keystroke text.
- Give every pointer gesture a keyboard or tap alternative. Update `ShortcutsDialog` when a shortcut changes, and add the shortcut in `useCanvasShortcuts` behind the existing guards (not while typing, not while editing, not while a dialog is open).
