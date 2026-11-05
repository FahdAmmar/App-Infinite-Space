---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
  - "index.html"
---

# Styling and design

## Tokens and themes

- Tailwind CSS 4 via `@tailwindcss/vite`. Colors, shadows, edge colors, and sticky colors are CSS variables in `src/styles/index.css`, defined per theme (`data-theme="dark"` default, `"light"`), and exposed to Tailwind through `@theme inline` (`bg-raised`, `text-ink`, `text-muted`, `border-line`, `text-danger`, `shadow-pop`, and so on).
- Components use token utilities. A raw hex value in a component is a defect: it will be wrong in one of the two themes.
- Check every visual change in **both** themes (and at 390 px width). Sticky colors are `--sticky-*` variables mirrored in `STICKY_COLORS`; add a color in both places and in both themes.
- The inline script in `index.html` sets `data-theme` before first paint from `infinitespace:v1:ui` (`state.theme`). Keep that key and field stable.

## Visual direction

- Follow the reference look: near-black canvas with thin borders in dark mode, neutral `#F2F2F2` canvas with white panels in light mode, white (dark) or black (light) primary action, violet accent for selection.
- Chrome floats: top pills, left tool rail, bottom creation dock, right properties panel, bottom-right zoom cluster. Do not add full-width bars to the editor.
- Cards share a small header (icon and label); tags render as `#tag` chips; groups are dashed translucent frames with a title bar; connections are curved with a violet-to-pink gradient.
- Take layout and color values from references only; no logos, icons, images, or text.

## Class hygiene

- `cn()` composes classes with `tailwind-merge`, which treats any custom class starting with `text-` (or another utility prefix) as a utility and may drop it. Name custom component classes without utility prefixes (`edge-label`, `skip-link`) and keep `cn.test.ts` covering new ones.
- Custom CSS belongs in `features/canvas/styles/canvas.css` (React Flow theming, node and edge styles) or `src/styles/index.css` (tokens). Prefer utilities for one-off layout.
- Use logical properties (`ps-*`, `ms-*`, `border-s`, `inset-inline-*`) in new code so the layout survives direction changes.

## Type and assets

- Fonts: Syne (display), IBM Plex Sans (body), IBM Plex Mono (code and numerals), self-hosted through Fontsource. No external font or script requests. No Arabic web font is bundled; Arabic text uses the system font.
- Icons come from `lucide-react`; import individual icons. Inline SVG for anything custom.

## Motion

- GSAP is for entrance and confirmation moments (dashboard reveal, editor chrome entry, new-card pop, "Saved" check). The canvas itself is never animated.
- Wrap GSAP in `gsap.matchMedia()` under `(prefers-reduced-motion: no-preference)`, use `clearProps` so no inline styles remain, and revert on cleanup. Hover effects stay CSS-only.
- The Three.js backdrop is decorative, dashboard-only, lazy-loaded, pointer-transparent, and off under reduced motion.

## Phones and user text

- A phone grid declares `grid-cols-1`. Without it the column grows to its widest content, so a 60-character name makes a card wider than the screen and the page wider than the phone.
- User text that is cut with an ellipsis (names, labels) uses `TruncatedText`, never `<bdi>`: `bdi` isolates direction but clips the wrong end of an Arabic name in an LTR layout. Inside a sentence (for example "in <name>") `bdi` is still right.
- On coarse pointers every text field is 16px (`index.css`), because iOS Safari zooms the page when a smaller field takes focus. Do not set a smaller size for touch.
- A decorative effect is not loaded where its element is `display: none`. `BackgroundEffect` follows the `md` breakpoint through `useMediaQuery`; keep the two in step.

## Credits

- Magic Card and Border Beam are adapted from Magic UI (MIT); keep the file-header credit. Keep React Flow's attribution link visible.
