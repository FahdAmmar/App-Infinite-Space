# Mobile fixes 1 to 5: hover, tap flash, height, input zoom, tap delay

Moved out of `SKILL.md` to keep it within the 200-line limit. Text is unchanged.

### 1. Hover state stuck after tap

Touch has no hover, so browsers fake one: the first tap on an element applies `:hover` and leaves it there until the user taps somewhere else. A button that scales up on hover stays scaled up after being tapped. Gate every hover style behind a capability query.

```css
@media (hover: hover) and (pointer: fine) {
  .button:hover {
    background: var(--gray-3);
    transform: scale(1.02);
  }
}
```

Both conditions matter. `(hover: hover)` means the primary input can hover. `(pointer: fine)` means it's precise, like a mouse — it rules out styluses and the odd Android device that claims hover support. In Tailwind v4 the `hover:` variant already compiles to `@media (hover: hover)`; in v3 set `future.hoverOnlyWhenSupported`.

Touch users still need press feedback. Give it to them through `:active` (see §5), which works on every input type.

### 2. Gray/blue flash on tap

iOS Safari and Android Chrome paint a translucent highlight over any tapped element that has a click handler. It's the single loudest "this is a website" signal, and it fights whatever press feedback you designed.

```css
html {
  -webkit-tap-highlight-color: transparent;
}
```

Set it once, globally. Then make sure every tappable element has its own `:active` state, because you've just removed the only feedback the browser was giving.

### 3. Layout has the wrong height

`100vh` on mobile is the *largest* viewport — the height with the browser chrome collapsed. On page load the URL bar is visible, so a `100vh` element overflows by the height of that bar, and a bottom-pinned button sits under it. Use the dynamic and small units instead:

```css
/* App shell, drawers, anything that should track the visible area as chrome shows/hides */
.app { height: 100dvh; }

/* Heroes and first screens — the smallest the viewport gets, so nothing is ever cut off */
.hero { min-height: 100svh; }
```

`dvh` resizes as the URL bar collapses, which is right for an app shell but causes layout shifts on marketing content mid-scroll. `svh` is stable and never overflows, which is right for a hero. `lvh` is the old `vh` — you almost never want it. Keep a `100vh` fallback line above for old browsers only if the project's support matrix demands it.

### 4. Page zooms into the input

iOS Safari zooms the page when focus lands on an input whose font size is under 16px, and it does not zoom back out on blur. The user is left looking at a cropped, drifted layout. This is the reason people reach for `maximum-scale=1`, which is the wrong fix (Hard Rule 4).

```css
input, textarea, select {
  font-size: 16px; /* the minimum; 1rem at the default root size */
}
```

If the design calls for smaller text in inputs on desktop, scale it up only where it matters:

```css
@media (pointer: coarse) {
  input, textarea, select { font-size: 16px; }
}
```

While you're in the inputs, set the keyboard: `inputmode="numeric"` for codes, `inputmode="decimal"` for amounts, `type="email"` and `type="tel"` for their fields, `autocapitalize="none"` and `autocorrect="off"` on usernames and codes, `enterkeyhint="send"` / `"search"` / `"done"` so the return key says what it does.

### 5. Tap feels laggy

Two separate causes stack here.

**The 300ms click delay.** Browsers wait after a tap to see whether a second tap is coming, because double-tap zooms. Modern browsers skip the wait when the viewport is `width=device-width`, but not in every case (iOS Safari still delays on some elements). `touch-action: manipulation` tells the browser this element never double-tap-zooms, so it fires `click` immediately:

```css
button, a, [role="button"], .tappable {
  touch-action: manipulation;
}
```

**Feedback on release instead of press.** Native buttons respond the instant your finger lands. A web button that only changes on `click` responds when your finger *leaves*, which reads as lag even at 0ms. Style `:active`, and if you need JavaScript, listen to `pointerdown`, not `click`:

```css
.button {
  transition: transform 100ms var(--ease-out), background 100ms;
}
.button:active {
  transform: scale(0.97);
  background: var(--gray-4);
}
```

Keep press feedback at 100–160ms and `ease-out`. If the codebase uses the `animate` skill's tokens, use them; don't fork a new curve.
