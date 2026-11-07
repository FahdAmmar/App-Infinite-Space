# Deploying to Vercel

InfiniteSpace is a static single-page app: no server, no database, no environment variables. Vercel only has to
build it and serve `dist/`. Everything the user creates is stored in their own browser.

**Status.** The configuration was written and checked locally (`npm run deploy:check`, and a local emulation of the
routing and headers). It has **not been deployed to Vercel from here**, and no browser was available to try the
deployed site. Treat the first deployment as the real test and use the checklist below.

## Before you deploy

Run these from a clean checkout. All must pass:

```bash
npm ci
npm run typecheck && npm run lint && npm test
npm run build
npm run deploy:check
```

`deploy:check` reads `vercel.json` and `dist/`. It verifies the single-page fallback, the cache and security headers,
that the Content-Security-Policy lists the hash of the one inline script, and that the bundle needs no `eval`.

## Option A: import from Git (recommended)

1. Push the project to GitHub, GitLab, or Bitbucket. `.env` is ignored by `.gitignore`; keep it that way.
2. In Vercel choose **Add New → Project**, import the repository, and keep the detected **Vite** preset. The install
   command, build command, and output folder come from `vercel.json`.
3. In **Settings → General → Node.js Version** pick **22.x**. The project was verified on Node 22.22; its `engines`
   field also allows 20.19 and newer, and Node 24 has not been tried.
4. Add no environment variables. Deploy.

## Option B: Vercel CLI

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

`.vercelignore` keeps tests, docs, and tooling out of the upload; the build does not need them.

## What `vercel.json` does

| Setting | Why |
| --- | --- |
| Rewrite everything except `/assets/` to `/index.html` | Deep links such as `/w/<id>` and a page reload need the app, because routing happens in the browser. A missing `/assets/` file stays a real 404 instead of returning HTML, which would break script loading in a confusing way. |
| `/assets/*` cached for a year, `immutable` | File names contain a content hash, so a changed file always has a new name. |
| HTML revalidated on every load | A new deployment is picked up at once. |
| `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy`, `Permissions-Policy` | Standard hardening; the app uses no camera, microphone, or location. |
| Enforced CSP: `object-src`, `base-uri`, `form-action`, `frame-ancestors` | Directives that cannot affect how the app runs. |
| Full CSP in **Report-Only** | See below. It includes `frame-src https://www.youtube-nocookie.com` for the video card; when you promote the policy, keep that directive. |

Vercel adds HTTPS and `Strict-Transport-Security` itself.

## Promoting the Content-Security-Policy

The full policy ships as `Content-Security-Policy-Report-Only`: the browser reports what it would block but blocks
nothing. It was built from what the code does (no network requests, local fonts, pictures shown from `blob:` URLs,
one inline script), but it could not be tried in a browser here, so it is not enforced yet.

1. Open the deployed site with DevTools open on the **Console**.
2. Use the app: toggle the theme and the background effect, create a workspace, add a card, paste or upload an image,
   open a link card, export and import a workspace, open *Data & backup*, and reload on a `/w/<id>` address.
3. If the Console shows no `[Report Only] Refused to …` lines, in `vercel.json` delete the enforced
   `Content-Security-Policy` entry and rename `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.
   Run `npm run deploy:check` and redeploy.
4. If lines appear, fix the policy (or the code) first. Do not add `'unsafe-eval'` or a wildcard script source.

If the inline script in `index.html` ever changes, its hash in the policy must change too; `deploy:check` fails
when they differ.

## Offline use and updates

The build writes `dist/sw.js` (from `src/pwa/sw.template.js`) and the app registers it in production only. It precaches the built files except the decorative 3D chunk and serves pages network-first (falling back to the cached shell after 4 seconds or when offline). A new deployment installs in the background; the app shows a "new version is ready" message and switches only when the user clicks *Reload*. `/sw.js` and `/manifest.webmanifest` fall under the existing no-cache rule for non-asset files, so an update is never hidden by the HTTP cache. After the first deployment, open DevTools → Application → Service Workers once and confirm it is active. `npm run size:check` fails the build if a chunk grows past its budget.

## Data belongs to one address

Browser storage is per origin. The production address, every preview address, and a custom domain each start empty,
and a user who moves from one to another does not carry their workspaces over. Choose the final domain before
people rely on the app. To move data, **Export** each workspace on the old address and **Import** the files on the
new one (Data & backup).

## After the first deployment

- [ ] The home page loads and shows no console errors (a `[Report Only]` line is the exception to investigate).
- [ ] Reloading on `/w/<id>` shows the app, not a 404.
- [ ] `/assets/does-not-exist.js` returns 404, not the app.
- [ ] Create a workspace, add cards and an image, reload: everything is still there.
- [ ] Export a workspace, delete it, import the file: it returns as a new workspace.
- [ ] Switch theme, reload: the theme is kept without a flash.
- [ ] Open the same workspace in two tabs, change one: the other shows the *changed in another tab* banner.
- [ ] Response headers on the page include the security headers above (DevTools → Network → Doc).
- [ ] The result looks right on a phone, in Chrome, Firefox, and Safari.

## Updating and rolling back

Each deployment has new hashed file names. A tab that was open before the update may fail to download a screen it had
not loaded yet and shows *This page couldn't load*; reloading fixes it, and saved data is untouched. To roll back,
use **Deployments → Promote** on an earlier deployment; users' browser data is not affected either way.

## Known gaps

- The deployment, the Vercel dashboard steps, and the live headers were not exercised from here.
- `vercel.json` was not validated by Vercel's own tooling; the checks in `deploy:check` are this project's.
- Preview deployments may need a Vercel login depending on the project's *Deployment Protection* setting.
