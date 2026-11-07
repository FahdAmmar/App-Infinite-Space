# Feature roadmap

Planned frontend work after the six original build phases, in priority order. A feature gets a ✅ only when it is
implemented **and** its automated checks pass; ⬜ means not done. What the app does today is described in
[docs/FEATURES.md](docs/FEATURES.md), and known gaps in [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

## Phase 7: Reliability and data safety

The app keeps everything in one browser, so losing that browser's data is the worst failure. This phase makes data
recoverable and moveable.

- ✅ **Error boundary and recovery screen.** A rendering error or a failed editor download shows a page with
  *Reload* and *Back to workspaces* instead of a blank screen.
- ✅ **Export a workspace.** One `.infinitespace.json` file with cards, connections, view, and images, from the card's
  ⋯ menu.
- ✅ **Import a workspace.** Adds the file as a new workspace through the same validation as saved data; a failed
  import leaves nothing behind.
- ✅ **Recovery copies screen.** Download, restore as a new workspace, or delete the copies kept when saved data could
  not be read.
- ✅ **Storage meter and protection.** Used and available space, warnings near the limit, and a request for persistent
  storage.
- ✅ **Two-tab conflict protection.** A tab that hears another tab save pauses its own saving and lets the user pick
  a version.
- ✅ **Run the Phase 7 browser flow** (`e2e/phase7_data_safety.py`) in real Chromium. It now passes 20 of 20 checks on
  five consecutive runs. Two selectors were ambiguous and one check raced the asynchronous recovery list; both fixed.

## Phase 8: Canvas productivity

- ✅ **Copy, cut, and paste cards,** including between workspaces, keeping the connections among the copied cards.
- ✅ **Reattach a connection** by dragging either end onto another card or another side of the same card (one undo
  step).
- ✅ **Align and distribute** a selection from the selection toolbar (one undo step each).
- ✅ **Snap to grid,** an optional setting that matches the background dots.
- ✅ **Browser flow for this phase** (`e2e/phase8_productivity.py`, 46 checks in Chromium). Running it found five real
  defects, all fixed: a refused self-connection gave no message, refusal toasts never went away and covered the
  selection toolbar, the zoom toolbar was 433 px wide and cut off on a 390 px phone, the collapsed properties panel
  stayed a 160 px empty block over the controls, and the selection toolbar left the screen near its edges.
- ⬜ **Guide lines** while dragging.
- ✅ **Find on canvas.** `Ctrl/⌘+F` (or the search button) searches card text, file names, links, and tags (`#tag` for
  tags only), steps through matches in reading order, and pans to each one.
- ✅ **Layers.** Bring to front and send to back, from the selection toolbar or `]` and `[`.
- ⬜ **Lock a card** so it cannot be moved by accident (needs a saved-data change, so it is planned separately).
- ⬜ **Export the canvas as an image** (PNG or SVG) of the whole canvas or the selection.
- ⬜ **Level-of-detail mode** for very large canvases zoomed far out (measure first; see the load test).

## Phase 9: Arabic, right-to-left, and offline

- ⬜ **Interface language layer.** A small typed dictionary (no heavy library), English and Arabic, with the choice
  remembered.
- ⬜ **Document direction.** `lang` and `dir` follow the language; the canvas itself stays left-to-right because its
  coordinates are, while toolbars, panels, and dialogs mirror.
- ⬜ **Logical CSS properties.** Replace the physical `ml-`, `pr-`, `left-`, `right-`, and `text-left` classes so
  mirroring does not need per-component fixes.
- ⬜ **Arabic web font** bundled locally (Cairo or Tajawal), loaded only for Arabic.
- ✅ **Installable and offline.** Web app manifest and icons, a service worker generated at build time that caches the
  built files, an "offline" message, and an update prompt that waits for the user (see Phase 17).

## Phase 10: Quality and tooling

- ⬜ **Port the browser flows to `@playwright/test`** (parallel runs, traces). `npm run e2e` already runs every Python
  flow with one command.
- ✅ **Continuous integration.** `.github/workflows/ci.yml` runs type check, lint, tests, build, deploy and size checks,
  docs check, audit, and the browser flows. Written in Phase 17; it has not run on GitHub yet.
- ⬜ **Coverage threshold** on the pure rules (codec, history, autosave, transfer) so it cannot silently drop.
- ⬜ **More React component tests.** The `src/test-utils/render.ts` helper added in Phase 7 is the starting point.
- ⬜ **Accessibility checks in the browser flows** with axe-core on every new screen.
- ✅ **Faster unit tests.** The default Vitest environment is `node`; the 20 files that need a DOM declare
  `// @vitest-environment jsdom`. The full run went from 112 s to between 37 and 59 s in two later runs (one-core sandbox).
- ⬜ **Firefox and WebKit runs** of the browser flows, and a pass with a real screen reader.

## Phase 11: Quick wins

Small changes with a large effect on how fast the canvas feels. Each one ships with unit tests and a browser check (`e2e/quickwins_flows.py`, 50 checks, all passing in headless Chromium).

- ✅ **Drag a connection dot onto empty canvas** to create a new card already connected to the first. Dropping on a
  card keeps today's behavior.
- ✅ **Paste text and links.** A pasted web address becomes a link card; pasted multi-line text becomes one card per
  paragraph. Pasting images and copied cards works as before.
- ✅ **Command palette** on `Ctrl/⌘+K`: create a card, undo and redo, fit and zoom, find, switch theme, filter by tag, and
  jump to another workspace by name. Keyboard only for now; a button for touch devices is still open.
- ✅ **Compress images when added.** Downscale large pictures and store them as WebP, with a "keep the original" choice.
  Smaller storage and smaller export files (Base64 adds a third). Done as: scale to 2,560 px, WebP at 0.82, kept only if
  at least 10% smaller; animated pictures and AVIF untouched; a command turns it off.
- ✅ **Filter by tag.** Clicking a tag on a card (or choosing it in the palette) dims every card that does not have it,
  with a pill showing the count; `Esc` clears it after the selection. A view setting, not saved with the workspace.

## Phase 12: New ways to think on the canvas

- ✅ **Presentation mode.** Each group is a slide; arrow keys fly the camera from group to group. Press `P` (or use the
  palette): slides run in reading order, the interface hides, editing is off, and `Esc` restores the previous view.
- ⬜ **Mind-map keyboard flow.** `Tab` adds a child, `Enter` a sibling. "Arrange as tree" (one undo step) shipped in
  Phase 18; the keys are still open, because `Tab` is how keyboard users move focus between cards, so the child
  shortcut needs another key.
- ✅ **Template gallery.** Mind map, Kanban, SWOT, retrospective, roadmap, chosen in the Create workspace dialog. They are
  built from the same card factories and go through the existing import validation, so there is no new data path.
- ✅ **Light Markdown in text cards and a checklist card** with progress. Rendered without raw HTML (Phase 18).
- ✅ **Status on cards** (none, in progress, done) and **card locking**, in one codec version (Phase 18). A due date is
  still ⬜.
- ⬜ **Export as an outline.** Markdown text built from the connections, next to the planned PNG/SVG export.

## Phase 13: Dashboard and phone polish

- ⬜ **Real thumbnails** on workspace cards (actual card colors and pictures instead of abstract blocks).
- ⬜ **Pin favorites** and show the "continue where you left off" row only when it adds something.
- ⬜ **Trash with 30-day restore** instead of deleting a workspace at once.
- ⬜ **Sample workspace** button in the empty dashboard.
- ✅ **Phone: single "+" creation button** that expands, replacing the dock. The breakpoint moved from 640 px to 900 px in
  Phase 18, when the dock grew to seven buttons and began to touch the getting-started list.

## Phase 14: Engineering

- ✅ **Automatic backup to a chosen folder** with the File System Access API (Chromium), falling back to downloads.
  A synced folder (OneDrive, Drive) then works as a simple multi-device sync without a server.
- ⬜ **Move export and import to a Web Worker** so a large workspace does not freeze the interface.
- ⬜ **Installable extras:** `share_target` (share a link or picture from a phone into the app) and `file_handlers`
  for `.infinitespace.json`.
- ⬜ **Fuzz and property tests** (for example fast-check) on the codec and importer, and visual snapshots in both
  themes.

## Phase 15: UX fixes found in review

Found by reading the code, the screenshots in `docs/screenshots/` and by running the app at phone size. Each has a unit test; the browser flow is `e2e/phase15_ux.py`.

- ✅ **Phone editor space.** The minimap was already hidden on phones; the real problem was the zoom toolbar wrapping into two rows (about 22% of the screen). It is one row now, and the empty canvas gives touch wording instead of keyboard wording.
- ✅ **Getting-started list** (bottom-left, hidden on phones): add a card, connect, tag, group. It ticks itself and can be dismissed once for all workspaces.
- ✅ **Dashboard "pick up where you left off" row** hidden when it only repeats the list below it.
- ✅ **Command palette button** in the top bar, so touch devices can open it (the theme button yields its place on phones).
- ✅ **Theme: Follow the system, and High contrast**, besides Dark and Light (palette commands; the default stays Dark).
- ✅ **Share metadata:** `theme-color` and Open Graph tags in `index.html`.
- ✅ **Copy diagnostics** button on the error screen (local only, no network, no workspace content).

## Phase 16: New ways to navigate and share

Browser flows: `e2e/phase16_navigation.py`, `phase16_share.py`, `phase16_snippets.py`.

- ✅ **Right-click menu** on the canvas, cards and connections (long-press on touch).
- ✅ **Focus branch** (`F`). Fades everything that is not upstream or downstream of the selected card.
- ✅ **Deep links.** `?card=<id>` opens a workspace at a card; "Copy link to card" in the menu. Works in this browser only (data is local).
- ✅ **Outline panel** (`O`). A list of groups and cards to jump to, with a filter; also a linear view for screen readers.
- ✅ **Semantic zoom.** Group titles stay readable when zoomed far out.
- ✅ **Save as a read-only HTML page.** One file, works offline, no network access (own CSP). From the workspace menu or the palette.
- ✅ **Search inside all workspaces** from the dashboard search box; a hit opens the workspace at that card.
- ✅ **Personal snippets** (palette): save a selection, insert it into any workspace. Image cards are left out on purpose, because unused images are cleaned up automatically.
- ⬜ **Shape cards** (rectangle, ellipse, diamond). Needs a saved-data change; planned together with locking and status.
- ⬜ **Snapshots.** Named restore points kept in the browser. Needs the image cleanup to treat snapshots as references first.
- ⬜ Not in this round: freehand pen, collapsing groups, saved viewpoints, workspace-to-workspace links (each needs a saved-data change).

## Phase 17: Fixes, speed, offline, and backup

Browser flows: `e2e/phase17_ux.py` (21 checks) and `e2e/phase17_backup.py` (19 checks).

- ✅ **Safe areas.** Floating bars keep clear of notches and the home indicator through `--safe-*` variables.
- ✅ **Create dialog.** The Create button stays visible without scrolling, on desktop and phones.
- ✅ **Dashboard empty state** aligned with the heading; the five templates start a populated workspace in one click.
- ✅ **No "Created ..." toast** after creating a workspace: opening it is the confirmation.
- ✅ **Dashboard entrance with Web Animations.** GSAP now loads only with the editor; the first-load script went from
  176.6 KB to 149.1 KB gzip.
- ✅ **Three.js backdrop** is skipped on devices reporting two cores or 2 GB or less, and loads when the browser is idle.
- ✅ **Size budgets** (`npm run size:check`) and **PWA checks** in `npm run deploy:check`.
- ✅ **Backup reminder** on the dashboard after 7 days without a backup (snooze 3 days), a **backup folder** that is
  refreshed while the app is open, and a **download fallback** for browsers without folder access.
- ⬜ **Promote the CSP** from Report-Only to enforced after a Vercel preview shows no violations (needs a live deployment).
- ⬜ **Arabic interface and RTL** (the rest of Phase 9): dictionary, logical CSS properties, and the Arabic font.

## Phase 18: Cards and tools inspired by Kinopio, Scrintal, and Miro

Built from five reference screenshots. Browser flows: `e2e/phase18_cards.py` (56 checks, all passing in headless
Chromium). Saved canvases move to `schemaVersion` 2 and export files to package version 2. Version 1 data opens unchanged,
and an older app version refuses version 2 data and keeps a backup instead of silently dropping the new fields.

- ✅ **Status ring** on every card (none, in progress, done): one click cycles it; shown by shape, not by color alone.
- ✅ **Card locking.** A locked card cannot be moved, resized, or deleted (also not by align or tree layouts); its text
  stays editable. Properties panel, command palette, and a lock icon on the card.
- ✅ **Orange and red** note colors (eight in all).
- ✅ **Image looks:** card, sticker (the picture alone, with a shadow that follows its shape), and cover (title over the picture).
- ✅ **Checklist card** (`K`): tick, edit, add, and remove items in place; progress bar; up to 40 items.
- ✅ **Light Markdown in text cards:** headings, bullet, numbered, and task lists, quotes, bold, italic, code, and
  `http(s)` links. No raw HTML; plain text keeps its line breaks.
- ✅ **Shape cards** (`S`): rectangle, ellipse, diamond, with text and a color.
- ✅ **Links panel** in the properties panel: where a card goes and where it comes from; click to jump.
- ✅ **Arrange as a tree** (follows the connections) and **arrange in columns by status** (a Kanban view of any
  selection). One undo step each.
- ✅ **YouTube video card** (`Y`). Nothing is requested from YouTube until you press play; the player is
  `youtube-nocookie.com` in a sandboxed frame, and the CSP allows that one host (see [docs/SECURITY.md](docs/SECURITY.md)).
- ⬜ **Export as PNG/SVG and as an HTML slide deck.** Not started.
- ⬜ **Tab/Enter mind-map keys** (see Phase 12) and the new card types in the right-click "add" menu.
- ⬜ **Due dates**, and the status ring is placed on the card's box, so on a diamond it floats just outside the shape.

## Needs an architecture decision first (not planned)

These need a server, accounts, or sending content off the device, which changes the privacy and security model.

- ⬜ **Cloud sync between devices:** authentication, conflict resolution, server storage, a security review.
- ⬜ **Link previews** through a serverless function: block private addresses, limit redirects, set timeouts, and make
  it opt-in because today the app never fetches pages.
- ⬜ **Live collaboration** (shared cursors, a Share button): needs a server, accounts, and a sync protocol.
- ⬜ **Web page embeds** inside a card (beyond the YouTube player): framing arbitrary sites needs a per-host allow-list
  and a stricter CSP.
- ⬜ **AI helpers** (for example summarizing a group): opt-in only, since card content would leave the device.

