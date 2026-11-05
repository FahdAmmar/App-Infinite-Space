# Features

What the application does today, how it looks, and which keyboard shortcuts it supports. Back to the [README](../README.md).

## Visual direction

The look follows six reference screenshots supplied for the project: dark whiteboard/canvas tools with floating pill-shaped bars, a left tool rail, a bottom dock, and tinted cards, plus a light sticky-note board.

- **Colors were sampled from the references**, not guessed: a near-black canvas with thin borders in dark mode, a neutral `#F2F2F2` canvas with white panels in light mode, a white (dark mode) / black (light mode) primary action, and a violet accent for selection.
- **Floating chrome:** the editor has no full-width bars. A top row of pills (logo, breadcrumb, save status, theme), a left rail (select, hand, connect), a bottom dock (sticky note, text, image, link, group), a floating properties panel on the right, and a bottom-right cluster (help, minimap, fit, zoom).
- **Sticky notes follow the theme:** tinted dark cards with a light border and white text in dark mode; bright paper-like notes with sharp corners and a paper shadow in light mode.
- **Layout and color values only** were taken as inspiration. No logos, icons, images, or text from the references are used.
- **Connections:** curved arrows with a violet-to-pink gradient along the line, circular handles on the four sides of every card (shown on hover, selection, or while connecting), a dot at the midpoint of a selected connection, and optional dashed or dotted lines and labels.
- **Cards:** image, link, and text cards share a small header (icon and label) like the reference cards; tags appear as `#tag` chips inside the card; groups are dashed translucent frames with a title bar.
- **Motion is restrained and purposeful** (GSAP): the dashboard reveals in sequence, a newly created or duplicated card enters with a short pop, the editor's floating chrome slides in when a workspace opens, and the "Saved" check pops once when a save completes. Nothing animates the canvas itself. All of it is off when the system asks for reduced motion.
- **Two effects adapted from [Magic UI](https://magicui.design) (MIT):** *Magic Card*, a soft spotlight and glowing border that follow the pointer over a workspace card, and *Border Beam*, a light that travels around the border of the one card on the empty dashboard. Both are plain CSS (no animation library), and the spotlight is written to the element directly, without re-rendering React.
- **Optional background effect (Three.js):** a slowly turning sphere of violet and pink dots behind the dashboard heading that leans a little toward the pointer. It is decorative, can be turned off with the sparkle button, and is never used in the editor.
- **Not copied:** the references also show collaboration (avatars, remote cursors, Share), a library search bar, and AI features. None of that is in scope for this project.

## Implementation status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation, design tokens, dashboard, workspace creation flow | **Done** |
| 2 | Canvas viewport, node model, sticky notes and text cards, selection, drag, edit, delete | **Done** |
| 3 | Edges (connections), image and link cards, groups, tags, properties panel | **Done** |
| 4 | Undo/redo, full persistence (IndexedDB), viewport restore, populated card previews | **Done** |
| 5 | Magic UI components, GSAP polish, optional Three.js effect, responsive/a11y pass | **Done** |
| 6 | Final verification across themes, devices, and large workspaces | **Done** |
| 7 | Data safety: error screen, export and import, recovery copies, storage meter, tab conflict protection | **Done** (browser flow written, not yet run) |

| 8 | Canvas productivity: copy and paste, reattach, align, distribute, snap, find, layers | **Partly done** (see [features.md](../features.md)) |
| 15 | UX fixes: phone toolbar, getting-started list, palette button, system and high-contrast themes, diagnostics | **Done** |
| 16 | Right-click menu, focus branch, deep links, outline, semantic zoom, read-only HTML page, search in all workspaces, snippets | **Done** except shape cards and snapshots |

The roadmap for the remaining work is in [features.md](../features.md).

### What works today

**Dashboard (Phase 1)**

- Create a workspace with a name, optional description, color, and icon; rename and customize, duplicate, and delete with confirmation.
- Search (name and description; accent- and case-insensitive; Arabic diacritics ignored) and sort (last modified, date created, name).
- "Pick up where you left off" row, last-modified time and item count on each card.
- Workspaces persist in the browser and sync between tabs.

**Canvas (Phase 2)**

- Pan by dragging the background (or switch to the Hand tool), zoom with the mouse wheel or the buttons, fit all content, zoom to selection, reset to 100%, optional minimap. Pinch-to-zoom comes from React Flow and was not tested on a touch device.
- Sticky notes (6 colors, resizable, title + multi-line text) and text cards. Text is edited directly inside the node.
- Select one or many nodes (`Shift`/`Ctrl`/`⌘` + click, `Shift` + drag box), drag them together, resize, duplicate, delete.
- Add at the pointer with `N`/`T`, double-click the background, or arm a tool from the dock and click (works with touch).
- A floating toolbar above the selection (note colors, duplicate, delete), helpful empty-canvas instructions, and a keyboard shortcuts dialog (`?`).
- Hand tool for pan-only navigation.

**Quality**

- Dark and light themes (remembered, no flash on load), `prefers-reduced-motion` support, keyboard-operable controls, labelled icon buttons.
- The dashboard, and the editor with a selected note and a text card, were audited with axe-core (WCAG 2.0/2.1 A and AA) in both themes with no violations. Dialogs and the empty-state screens were checked manually, not with axe.

**Relationships (Phase 3)**

- **Connections.** Drag from a dot on any side of a card to another card, or use the Connect tool (`C`): click the first card, then the second (works on touch). Any dot connects to any dot. A connection follows its cards when they move and is deleted with them. Rules: no self-connections, no duplicate in the same direction (the reverse is allowed), and groups cannot be connected.
- **Connection properties.** Shape (curved, straight, stepped), line style (solid, dashed, dotted), arrows (none, end, start, both), color (gradient or six solid colors), and an optional label.
- **Images.** Add from the dock or `I`, drag files onto the canvas, or paste from the clipboard. PNG, JPEG, WebP, GIF, and AVIF up to 10 MB and 40 megapixels; up to 12 files at once. Files are stored in IndexedDB. Resizing changes the width and the height follows the original aspect ratio. Double-click opens a large preview. Replace the picture from the properties panel.
- **Links.** A link card holds an address, an optional title, and an optional description, and opens in a new tab. Only `http` and `https` addresses are accepted (`example.com` becomes `https://example.com/`). The app never fetches the page, so there are no automatic previews or favicons.
- **Groups.** A dashed frame with a name and a color. Drop a card so its center is inside the frame to add it; dragging it out releases it. Move the frame by its title bar and its cards move with it. Resizing the frame adds the cards it now covers and releases those it no longer covers. Deleting a frame keeps its cards in place. Duplicating a frame duplicates its cards and the connections between them. Groups cannot be nested.
- **Tags** on any card (up to 8, 24 characters each), shown as chips and edited in the properties panel.
- **Properties panel.** Appears for one selected card or connection (a short summary for several). Edit text, color, tags, size, and style; Duplicate, Connect to…, and Delete. It collapses, and becomes a bottom sheet on phones. Fields apply when you press `Enter` or leave the field, not on every keystroke.

**Saving and history (Phase 4)**

- **Automatic saving.** Every change to cards, connections, groups, images, tags, and the view (pan and zoom) is saved to the browser about 0.8 s after you stop (at most 5 s after the first change). Selecting, hovering, and measuring never trigger a save. Reloading restores the canvas exactly, including the position and zoom.
- **Save status** in the top bar: *Saved*, *Saving…* / *Unsaved changes*, or *Not saved* with a **Retry** button when the browser refuses the write (storage full, blocked, or unavailable). Your work stays on screen while saving fails, and the next edit retries automatically.
- **Leaving safely.** Going back to the dashboard saves immediately. Closing or reloading the tab starts a save at once, and the browser asks for confirmation if changes are still unsaved or a save has failed.
- **Undo and redo** (`Ctrl/⌘+Z`, `Ctrl/⌘+Shift+Z` or `Ctrl+Y`, and buttons in the top bar). Up to 100 steps. A step is one user action: a whole drag, a whole resize, one text edit, a delete together with its connections, a duplicate. Creating a note and typing its first text is one step. Quick repeated nudges with the arrow keys are merged. Selecting and panning are not steps. History lives for the session only: it is empty after a reload.
- **Dashboard cards** show the real item count, a scaled preview of the canvas, and "last modified" (which changes only when the content changes, not when you pan).
- **Duplicating a workspace** copies its canvas, and deleting one removes its canvas.
- **Unused images are cleaned up** once per app start (after 8 s): image files that no saved canvas references and that are older than 24 hours are deleted. Cleanup does nothing if any workspace or canvas cannot be read.
- **Damaged data is handled, not trusted.** Unknown or broken cards and connections are skipped with a message; link addresses are validated again. If a whole saved canvas cannot be understood (for example, written by a newer version), the editor opens empty, explains why, and keeps a backup copy of the original so the next save cannot destroy it. If the canvas cannot be read at all (storage blocked), the editor refuses to open an empty canvas that would overwrite it, and offers *Try again*.

**Polish, effects, and accessibility (Phase 5)**

- **Background effect.** On by default on screens at least 768 px wide; the sparkle button in the dashboard header turns it off or on, and the choice is remembered. It is not created at all when the system asks for reduced motion or the browser reports data saving (the button is then disabled and says why), when WebGL is unavailable, or on phones. It stops drawing while the tab is hidden or the effect is scrolled out of view, uses a capped pixel ratio and the low-power GPU hint, and frees every GPU resource when turned off or when you leave the dashboard. It loads as a separate chunk (about 131 KB gzipped) only when it is needed: opening a workspace directly never downloads it.
- **Magic Card and Border Beam** (see Visual direction). The beam is hidden where the browser lacks `offset-path: rect()`, and with reduced motion.
- **Motion** (GSAP) never leaves inline styles behind and never touches elements that React Flow positions with its own transforms.
- **Keyboard.** The first Tab stop in the editor is a "Skip to canvas" link. Tab reaches cards and connections and shows a focus ring on them; `Enter` or `Space` selects, the arrow keys move a selected card, `Delete` removes it, `Ctrl/⌘+Z` undoes. Screen readers get a description of those keys when a card or connection is focused, and an announcement of each move.
- **Size limit and large canvases (Phase 6).** A workspace holds at most **5,000 items** and 10,000 connections, enforced when you add, duplicate, or connect (you get a message) and again when a saved canvas is read, so nothing can be created that would be silently cut off on the next open. Canvases above 1,500 items start with the minimap hidden, because it draws one rectangle per item and was the largest single cost per frame; the minimap button shows it again.
- **Phones and tablets.** Layout was checked at 390, 768, 1024, and 1440 px: no horizontal scrolling, the toolbars never overlap (below 900 px the zoom cluster and minimap sit above the dock), and the properties panel starts collapsed under 1024 px. On touch screens every ordinary button is at least 44 × 44 px, small buttons (color swatches, tag removal) keep their look but get a 44 px touch area, and the connection dots and resize handles are larger.

**Data safety (Phase 7)**

- **Error screen.** A rendering error, or an editor download that fails (offline, or the app was updated while a tab was open), shows a page with *Reload* and *Back to workspaces* instead of a blank screen. It shows the error message only, never a stack.
- **Export.** The ⋯ menu of a workspace card has *Export*: one `.infinitespace.json` file with the cards, connections, view, and every image. Cards whose image is no longer in the browser are exported without a picture, and you are told.
- **Import.** *Data* in the dashboard header opens *Data & backup*; *Choose file…* adds the file as a **new** workspace (a clashing name gets "(copy)"). Nothing existing is changed. The file is untrusted: cards and links go through the same validation as saved data, images must be real PNG, JPEG, WebP, GIF, or AVIF files within the size and pixel limits, and every image gets a new id, so a file cannot point at another workspace's pictures. If anything fails, what was written is removed again.
- **Recovery copies.** The same dialog lists the copies kept when saved data could not be read. Each can be downloaded, restored as a new workspace (or, for a workspace-list copy, re-adding missing workspaces), or deleted after a second click.
- **Storage meter.** Used and available space with an accessible meter, a note when it passes 80% and 95%, and *Protect my data* (asks the browser for persistent storage and reports whether it agreed). A warning also appears once per session on the dashboard when storage is nearly full.
- **Two-tab protection.** When another tab saves a change to the workspace you have open, saving here pauses (the pill says *Saving paused*) and a banner offers *Load latest* (discards unsaved changes in this tab) or *Keep this version* (your next save replaces the other tab's changes).

**Canvas productivity (Phase 8, partly done)**

- **Copy, cut, and paste** (`Ctrl/⌘+C`, `X`, `V`). The selection is copied with the members of any selected group and the connections between the copied cards. Paste puts the copy at the pointer (or the middle of the view), selects it, and is one undo step. It works between workspaces opened in the same tab, because the copy is held in memory, not in the operating system's clipboard. A card copied from inside a group you did not copy is pasted on its own, and joins a group if it lands inside one.
- **Reattach a connection.** With the Select tool, drag either end of a connection onto another card, or onto another side of the same card. Style, arrows, and label are kept. A move that would connect a card to itself, connect a group, or duplicate another connection is refused with a message.
- **Align and distribute.** With two or more cards selected, the toolbar above them aligns left, center, right, top, middle, or bottom edges to the selection's bounds, and (for three or more) spaces them evenly across or down. A card inside a selected group moves with the group instead of being aligned on its own.
- **Snap to grid.** The grid button in the bottom-right cluster snaps dragging to the 20 px background dots. The choice is remembered for all workspaces.
- **Find on canvas.** `Ctrl/⌘+F` or the search button opens a find bar. It matches titles, text, descriptions, file names, link addresses, group labels, and tags, ignoring case, accents, and Arabic diacritics. Every word you type must match (in any order); start with `#` to search tags only. Typing jumps to the first match; `Enter` and `Shift+Enter` step through the matches from the top of the canvas down, selecting and centering each. `Esc` closes it.
- **Layers.** *Bring to front* and *Send to back* (toolbar, or `]` and `[`) change which card is drawn on top. Groups always stay behind cards. The order is saved with the workspace.

**Quick creation (Phase 11)**

- **Drag a connection dot onto empty canvas.** Releasing a drag from a card's dot over empty space creates a new sticky note there, already connected from that dot, and opens it for typing. The card and its connection are one undo step. A tiny drag (under about 28 px) does nothing, so a click on a dot never creates a card. Releasing on a card connects as before, and a refused drop (itself, a group, a duplicate) now says why.
- **Paste text and links.** Pasting plain text (not copied cards or pictures) creates cards at the pointer. A web address on its own line (`http://`, `https://`, or `www.`) becomes a link card; every other paragraph (separated by a blank line) becomes one note, or a text card when it is longer than 280 characters. Lines without a blank line between them stay together in one card. At most 20 cards are created per paste and each holds up to 5,000 characters; the rest is reported. A single word or a bare domain stays text, and addresses such as `javascript:` or ones with a user name are never made into links.
- **Command palette.** `Ctrl/⌘+K` opens a searchable list of actions: create cards, undo and redo, select all, duplicate and delete, fit and zoom, find, show or hide the minimap, snap to grid, switch theme, the shortcuts list, compress images on or off, show only one tag, and *Go to all workspaces* or *Open workspace: …* for each other workspace. Type to filter (every word must match; some actions have hidden synonyms), `↑` `↓` to move, `Enter` to run, `Esc` to close.
- **Image compression.** When a picture is added, one larger than 2,560 px on its longest side is scaled down, and a file of 400 KB or more is re-encoded as WebP (quality 0.82); the result is kept only if it is at least 10% smaller. Animated GIFs, animated PNG and WebP, and AVIF files are stored untouched. In one test a 2.4 MB noise picture became about 570 KB. The *Keep original quality for new images* command turns it off (the choice is remembered). Pictures already on a canvas are not changed.
- **Filter by tag.** Clicking a tag on a card fades every card (and connection) that does not carry it, and a pill shows `#tag · 2 of 3 cards`. Click the tag again, use the pill's button, or press `Esc` (after any selection is cleared) to show everything. Tags ignore letter case, groups stay visible, faded cards can still be selected, and the filter is not saved with the workspace.

**Presentation mode and templates (Phase 12)**

- **Presentation mode.** `P` (or *Start presentation* in the palette) turns every group into a slide, in reading order: rows from top to bottom, left to right within a row. The camera flies to each group and frames it with a margin; the top bar, tools, zoom controls, panels and connection handles disappear and a small pill shows the slide title and `2 / 5`. Move with `→`, `↓`, `Space`, `PageDown` or `N` (next) and `←`, `↑`, `PageUp`, `Backspace` or `P` (previous); `Home` and `End` jump to the ends; `Esc` or the pill's button exits and restores the view you had before. The last slide does not wrap round. Nothing can be edited meanwhile: shortcuts such as delete, undo and the palette are blocked, cards cannot be dragged or selected, and links inside link cards still open. Panning and zooming stay possible; the next slide re-frames. If a group is selected, the presentation starts on it. With no groups it says to add one first. With reduced motion the camera jumps instead of flying.
- **Templates.** *Create workspace* has a *Start from* choice: Blank, Mind map, Kanban, SWOT, Retrospective or Roadmap. A template fills in a suggested name (only into an empty name field, or one it suggested itself), color and icon (unless you picked your own), and opens already centered on the window. Columns and quadrants are groups, so the notes inside move with them; the mind map and roadmap come with connections. The notes hold short prompts that you overwrite.

**Navigation and sharing (Phases 15 and 16)**

- **Right-click menu** on the canvas, a card, several cards, or a connection (long-press on a touch screen). Every entry calls the same command as its button or shortcut. It sets the context: a card outside the selection is selected first.
- **Focus branch** (`F`): fades every card that is not upstream or downstream of the selected card, following the arrows; a badge shows "3 of 12 cards". It is a view setting and is not saved. Palette, menu and `Esc` clear it.
- **Deep links:** "Copy link to card" gives `/w/<workspace>?card=<id>`. Opening it selects and shows the card, or says that it no longer exists. It works in the browser that holds the data.
- **Outline** (`O`): a filterable list of groups and cards in reading order; clicking a row jumps to it. It is also a linear view for screen readers.
- **Semantic zoom:** group titles grow as you zoom out (up to 3 times) so a large canvas stays readable.
- **Read-only HTML page:** workspace menu → "Save as read-only page", or the palette. One file with pan, zoom, fit and a theme switch, readable offline. It carries its own strict Content-Security-Policy (no network), builds the page with text nodes only, and embeds only PNG, JPEG, WebP and GIF pictures.
- **Search in all workspaces:** typing in the dashboard search also lists matching cards; a hit opens the workspace at that card. The index is built on the first search and only for workspaces that changed.
- **Snippets:** from the palette, save the selected cards and the connections between them, and insert them into any workspace (30 at most). Image cards are left out on purpose.
- **Themes:** Dark (default), Light, "Follow the system appearance" and High contrast (palette commands).
- **Getting-started list** (bottom-left, desktop only), **command palette button** in the top bar, and **Copy diagnostics** on the error screen.

**Phone and layout fixes found by browser testing**

- The bottom-right controls fit one row on phones (the shortcuts and snap buttons are hidden there; they were two rows, about a fifth of the screen), and rise above the dock under 1100 px.
- The properties panel, when collapsed, is a title bar instead of a 160 px empty block, and on phones it sits above those controls.
- The action bar above a selection stays inside the screen and flips below the selection when the top bar would cover it; it is hidden while a creation tool is armed.
- Refusal messages (limits, invalid connections) disappear after 8 seconds instead of staying until dismissed, because they covered the action bar.

### Not implemented yet

Shape cards, snapshots, guide lines while dragging, locking a card, export of the canvas as an image, a level-of-detail mode, restoring undo history after a reload, live sync between tabs, scheduled or automatic backups, and a larger selection of Magic UI components (only the two above were used, because only these two had a clear job). See [features.md](../features.md) for the planned phases.

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `V` / `H` / `C` | Select tool / Hand tool / Connect tool |
| `N` / `T` | New sticky note / text card at the pointer |
| `L` / `G` | New link card / group at the pointer |
| `I` | Add images from your device |
| Drop or paste an image | Add it to the canvas |
| Drag from a card's dot | Connect two cards, or create a connected card on empty canvas |
| Paste text or a web address | New note and link cards at the pointer |
| `Ctrl/⌘ + K` | Command palette |
| `F` | Focus on the selected card's branch (again or `Esc` to clear) |
| `O` | Show or hide the outline |
| Right-click, or long-press on touch | Context menu |
| `P` | Present: each group is a slide (arrows or `Space` to move, `Esc` to exit) |
| Double-click background (or inside a group) | New sticky note |
| `F2` | Edit the selected card (not images; use the properties panel) |
| `Esc` | Finish editing, cancel an armed tool, clear selection, then clear a focus, then a tag filter |
| `Ctrl/⌘ + A` / `Ctrl/⌘ + D` | Select all / duplicate selection |
| `Ctrl/⌘ + C` / `X` / `V` | Copy / cut / paste cards (also into another workspace) |
| `Ctrl/⌘ + F` | Find on canvas |
| `]` / `[` | Bring to front / send to back |
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl/⌘ + Shift + Z`, `Ctrl + Y` | Redo |
| `Delete` / `Backspace` | Delete selection |
| `Shift` + drag, `Shift`/`Ctrl`/`⌘` + click | Box select, add to selection |
| `+` / `-`, `Shift+1`, `Shift+2` | Zoom, fit all, zoom to selection |
| `Ctrl/⌘ + Enter` | Finish editing text, or save a link card |
| `?` | Show the shortcuts list |

Shortcuts are inactive while typing in a field, while a node is being edited, and while a dialog is open.
