# Mobile fixes 6 to 11: pull-to-refresh, notch, selection, carousel, status bar, device testing

Moved out of `SKILL.md` to keep it within the 200-line limit. Text is unchanged.

### 6. Pull-to-refresh hijacks scroll

Scrolling past the top of the page triggers pull-to-refresh on Android Chrome and the whole-page rubber band on iOS. Fine on a document. Wrong in an app with its own scroll containers, a drawer the user drags down, or a canvas.

```css
html, body {
  overscroll-behavior: none;
}
```

Then, on any inner scrollable — a sheet's content, a chat list, a sidebar — stop scroll from chaining to the page when it hits the end:

```css
.sheet-content {
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

`contain` keeps the container's own bounce (which feels native) but stops the page behind it from moving. Use `none` on the root, `contain` on children. Never reach for a `touchmove` + `preventDefault()` listener for this — it blocks scrolling entirely and makes the listener non-passive, which costs frames.

### 7. Content stops at the notch

By default the browser letterboxes your page inside the safe area, leaving the notch, Dynamic Island, and home-indicator zones the body's background color. A native app paints edge to edge and pads its *content* away from those zones. Two steps:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

```css
.app-header {
  padding-top: env(safe-area-inset-top);
}
.bottom-bar {
  padding-bottom: env(safe-area-inset-bottom);
}
.sheet {
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}
```

`viewport-fit=cover` lets the page under the notch; `env(safe-area-inset-*)` gives you the insets to pad back out. Without the meta tag the `env()` values are all `0px`. Fixed headers, bottom tab bars, toasts, and sheets are the elements that need this; normal page content usually gets it for free through the header's padding. Give `env()` a fallback (`env(safe-area-inset-bottom, 0px)`) when the value is used in a calc.

### 8. Long-press selects button text

Hold a finger on a web button and iOS selects its label, or pops the copy/share callout on a link. Native controls never do that. Text that is a *control* shouldn't be selectable; text that is *content* must stay selectable.

```css
button, [role="button"], .tab, .chip, .drag-handle {
  user-select: none;
  -webkit-user-select: none;   /* Safari still needs the prefix */
  -webkit-touch-callout: none; /* no long-press callout on links/images used as controls */
}
```

Never put `user-select: none` on `body`. Users copy addresses, error messages, and order numbers; that is content.

### 9. Carousel scrolls vertically

A horizontal swipe on a carousel is ambiguous to the browser — it doesn't know whether you're scrolling the page or the track, so it guesses, and the guess is often the page jittering up while the carousel moves. Tell it which axes the element owns:

```css
.carousel {
  touch-action: pan-y; /* the carousel handles horizontal; the browser keeps vertical */
}
.drag-surface {
  touch-action: none;  /* a custom gesture (a drag-to-dismiss sheet, a slider) owns every axis */
}
.vertical-sheet-handle {
  touch-action: pan-x; /* the sheet handles vertical drags; horizontal stays with the browser */
}
```

The values name what the *browser* may still do. `pan-y` on a horizontal carousel means "browser, you keep vertical panning; I'm handling horizontal". `none` means the element handles everything — use it only on elements that really do, or the user won't be able to scroll past them.

If the carousel is native scroll rather than a JS gesture, prefer `scroll-snap-type: x mandatory` on the track and `scroll-snap-align: start` on slides — the browser's own physics beat a hand-rolled spring, and `touch-action` becomes unnecessary.

### 10. Status bar color doesn't match

The status bar and the browser chrome take their color from `theme-color`. One value means light mode gets a dark bar or dark mode gets a white one. Give each scheme its own:

```html
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0a0a0a" />
<meta name="color-scheme" content="light dark" />
```

Match the value to the color at the very top of your page — the header background, not the brand color. In Next.js set it through the `viewport` export (`themeColor: [{ media, color }]`). If the app switches theme with a class rather than the OS setting, update the tag from JavaScript on toggle. For an installed PWA, `apple-mobile-web-app-status-bar-style` and the manifest's `theme_color`/`background_color` are the same decision.

### 11. Right in Chrome, wrong on phone

Nothing above reproduces in device emulation. Sticky hover, the tap highlight, the URL bar's effect on `vh`, input zoom, the click delay, overscroll, safe areas, the software keyboard — every one is a real-hardware behavior.

- Connect the phone over USB, run the dev server on `0.0.0.0`, open it by the machine's LAN IP.
- iOS: Safari → Develop → the device. Android: `chrome://inspect`.
- Test on a phone that's a few years old, not the newest one on your desk. Test with the keyboard open. Test in landscape once.
- Test as an installed PWA if that's a target; standalone mode changes viewport, safe areas, and status bar behavior.

The Xcode Simulator is a step up from emulation but still misses touch feel. Real hardware is the bar.
