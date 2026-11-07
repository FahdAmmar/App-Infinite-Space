# Cards and tools added in Phase 18

Continues [FEATURES.md](FEATURES.md). Back to the [README](../README.md).

## Inspired by Kinopio, Scrintal, and Miro

- **Status ring.** Every card except a group has a small ring in its corner. Click it to cycle none, in progress (half
  filled), and done (a check mark). Also in the properties panel and the command palette (mark as done, in progress, or clear).
- **Locking.** Lock from the properties panel or the palette. A locked card shows a small lock, cannot be dragged, resized,
  or deleted, and stays where it is when you align, distribute, or arrange a selection. You can still edit its text.
  Dragging a locked card moves the canvas instead.
- **Colors.** Notes and groups also come in orange and red.
- **Images** can look like a card, a sticker (the picture alone; transparent PNGs keep their shape), or a cover (title and
  description over the picture). Choose it in the properties panel.
- **Checklist cards** (`K`). Type an item and press Enter; tick items to move the progress bar; clear an item's text or use
  the × to remove it. Items are limited to 40 of 160 characters.
- **Text cards read light Markdown:** `#` to `###` headings, `-` and `1.` lists, `- [ ]` and `- [x]` tasks, `>` quotes,
  `**bold**`, `*italic*`, `` `code` ``, and `[text](https://…)` links. Other HTML is shown as plain text.
- **Shapes** (`S`): rectangle, ellipse, or diamond with optional text (double-click or `F2`; `Ctrl/⌘+Enter` saves) and a color.
- **Links panel.** Select a connected card and the properties panel lists the cards it goes to and comes from, with the
  connection labels. Click one to move to it.
- **Arrange.** With two or more cards selected, the selection toolbar adds *Arrange as a tree* (follows the connections,
  left to right, parents centered on their children) and *Arrange in columns by status*. Both are one undo step.
- **YouTube video cards** (`Y`). Paste a YouTube link (`youtube.com`, `youtu.be`, shorts, embed). The card shows a play
  button and makes no request until you press it. Other addresses are refused.
- **Dock and phones.** The dock now has seven tools, so the compact "+" menu starts below 900 px (it was 640 px).
  The video card is created with `Y` or the palette, not from the dock.

