---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
---

# Accessibility and motion

## Keyboard and focus

- Every interactive element is reachable and operable by keyboard with a visible focus indicator. The editor keeps its skip link.
- Shortcuts are window-level in `useCanvasShortcuts` and stay silent while the user types (`isTypingTarget`), edits a card, or has a `dialog[open]`. New shortcuts follow the same guards and appear in `ShortcutsDialog`.
- Modals use `components/ui/Dialog.tsx` (native `<dialog>` with an explicit focus trap and `data-autofocus` for the initial target). With a single focusable element Chromium can send focus to `<body>`; confirm focus stays inside after opening.
- Cards move and select with the keyboard through React Flow; keep that working when changing node markup.

## Names, states, announcements

- Icon-only buttons have an `aria-label`. Toggles expose `aria-pressed` or `aria-expanded`.
- Status changes reach assistive technology: toasts render in the permanent `aria-live="polite"` region (`Toaster`), transient hints use `role="status"`, and field errors use `role="alert"` linked with `aria-describedby`.
- Loading regions carry `role="status"` and `aria-busy`.
- Screen-reader announcements have not been verified with a real screen reader; report any change that touches them as untested unless one was used.

## Touch and responsive

- Targets are at least 44 px on coarse pointers. Layouts hold at 390, 768, 1024, and 1440 px with no overflow and no overlapping chrome.
- Gesture-only features keep an alternative: double-click creation has "pick a tool, then tap the canvas".

## Contrast and color

- Convey meaning with more than color (shape, outline, text, or icon). Verify contrast in both themes with axe; token pairs (`--c-*` and its `-ink`) are tuned together, so change them together.

## Reduced motion

- Honor `prefers-reduced-motion`: GSAP inside `gsap.matchMedia()`, CSS inside `@media (prefers-reduced-motion: reduce)`, and the Three.js backdrop disabled (`useEffectsAllowed`). Decorative pointer effects also require `(pointer: fine)`.

## Text direction

- The interface is English and left-to-right. User-entered text that may be Arabic uses `dir="auto"` and must display correctly right-to-left inside cards, inputs, and previews.
