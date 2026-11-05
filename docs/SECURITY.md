# Security

The attack surface of a local-first app and how each part is handled. Back to the [README](../README.md).

## Security considerations

- No backend, no network requests from application code, no external fonts or scripts.
- No `dangerouslySetInnerHTML`; user text is rendered through React's escaping. Workspace names and descriptions are normalized (control characters removed, whitespace collapsed) and length-limited on input and again on load. Node titles and text are length-limited by the input fields.
- **Links:** only `http` and `https` are accepted; `javascript:`, `data:`, `file:`, `blob:`, `ftp:`, `mailto:` and addresses with embedded credentials are rejected. The address is validated again when a link card is rendered, and the anchor uses `target="_blank"` with `rel="noopener noreferrer"`. The app makes no request to the address.
- **Images:** the type is checked against an allow-list (SVG is excluded because it can carry scripts), the size is capped at 10 MB, the decoded pixel count at 40 megapixels, and a file that cannot be decoded is rejected. Images are shown through `blob:` URLs created from the stored bytes. Decoding happens in the browser, so a very large but valid image can still take a moment.
- **Saved data is untrusted.** Anything read back from the browser's storage is validated and rebuilt (see Key decisions), so editing the stored data by hand, or data from another version, cannot inject a `javascript:` link, a malformed card, or an oversized value into the app. The backup copy of unreadable data is stored as is and is never executed or rendered.
- `index.html` contains a small inline script that applies the saved theme (and the system or high-contrast choice) before first paint. If you deploy behind a strict Content-Security-Policy, allow it with a hash or nonce; `deploy:check` fails when the hash in `vercel.json` is out of date.
- `npm audit --omit=dev` (what ships to users) reports 0 vulnerabilities. The full `npm audit` reported 0 earlier, and on 31 October 2026 reported 12 moderate findings that are one advisory (denial of service in `minimatch` before 11.0.1 through crafted glob patterns) reached only through the development linter (`eslint`, `typescript-eslint`). Nothing from that chain is in the built site, and the only offered fix is `npm audit fix --force`, a breaking change that was deliberately not applied. Revisit when a compatible `eslint` release picks up the newer `minimatch`.
- Workspaces are stored **only in this browser** and do not sync between devices or browsers.
- **The read-only HTML page** puts workspace data in a `<script type="application/json">` after escaping `<`, `>`, `&` and the line separators U+2028 and U+2029, so text cannot close the tag. The page builds its elements with `textContent` only, opens links only when they start with `http://` or `https://` (with `rel="noopener noreferrer"`), embeds only PNG, JPEG, WebP and GIF data URIs that match a strict pattern, and carries `default-src 'none'` so it cannot reach the network. Unit tests and a browser flow with a `</script><img onerror>` card check this.
- **Card links** (`?card=`) are accepted only when they look like an id (letters, digits, hyphens, 8 to 64 characters); anything else is ignored and removed from the address.
- **Snippets** are read back through the same validator as canvases, so edited `localStorage` data cannot inject a card, a link scheme or an image.
- **The error screen's diagnostics** hold the version, browser, language, screen size and a path with the workspace id replaced; no workspace names or content. Nothing is sent anywhere: it is copied to the clipboard on request.

