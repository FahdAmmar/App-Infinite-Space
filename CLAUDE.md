# InfiniteSpace

Local-first visual thinking app: a dashboard of named workspaces plus a full-screen infinite-canvas editor (sticky, text, image, link, checklist, shape, video, and group cards joined by connections). Frontend only: React 19, Vite, strict TypeScript, Tailwind CSS 4, Zustand 5, React Flow (`@xyflow/react`), GSAP, and an optional decorative Three.js backdrop. No backend, no network calls from app code, no accounts. Data stays in the browser (localStorage for workspace metadata, IndexedDB for canvases and images).

## Standing rules from the project owner (they override any skill or habit)

1. **No git.** Run no git command (commit, push, diff, status, branch, stash) unless the user explicitly asks for it in the current conversation.
2. **Markdown files stay at or under 200 lines** (README, docs, rules, agents, skills, references). Split at a heading boundary before exceeding. `npm run docs:check` verifies it.
3. **Before delivering any `.zip`, run `/verify full`**: typecheck, lint, all unit tests, build, all Playwright flows, `npm audit`, `docs:check`. Deliver only when everything passes and the project is ready to upload; otherwise report what failed instead of delivering.
4. **README.md has five parts in this order:** title, technology badges, screenshots, project explanation, future additions. Detail lives in `docs/`.

## How work is done here

- Deliver in thin vertical slices. Every slice leaves typecheck, lint, tests, and build green.
- "Done" means evidence: report real command output, and list every check not run as not verified.
- Make the smallest complete change. A new dependency needs a stated reason (`docs/ARCHITECTURE.md` explains the deliberate version pins).

## Conventions the code does not announce

- Code comments are Arabic and explain *why*; identifiers, UI copy, tests, and docs are English.
- Import through the `@/` alias (`src/`). Type-only imports use `import type` (lint-enforced). `any` is a lint error. `noUncheckedIndexedAccess` is on.
- React Flow registries (`nodeTypes`, `edgeTypes`) are module-level constants; creating them inside a component remounts every node on each render.
- A Zustand selector that returns an array or object is wrapped in `useShallow` (Zustand 5 loops otherwise).
- A custom CSS class never starts with a Tailwind utility prefix such as `text-`: `cn()` (tailwind-merge) silently drops it.
- Everything read from storage is untrusted and passes through `canvas-codec.ts`.
- User text cut with an ellipsis uses `TruncatedText`, not `<bdi>` (it clips the wrong end of Arabic names), and a phone grid declares `grid-cols-1`. Details: `.claude/rules/styling-and-design.md`.
- The inline theme script in `index.html` reads the `infinitespace:v1:ui` key and the `state.theme` field. Renaming either breaks first-paint theming.

## Read before touching an area

| Area | Open first |
| --- | --- |
| Any change | `.claude/rules/architecture.md` |
| Stores, persistence, codec, undo | `.claude/rules/state-and-persistence.md` |
| Cards, connections, groups, React Flow | `.claude/rules/canvas-and-nodes.md` |
| Tailwind, tokens, themes, motion | `.claude/rules/styling-and-design.md` |
| Links, images, stored data, dependencies | `.claude/rules/security.md` |
| Tests and Playwright flows | `.claude/rules/testing.md` |
| Keyboard, focus, screen readers, touch | `.claude/rules/accessibility-and-motion.md` |
| Large canvases, bundle size | `.claude/rules/performance.md` |
| README, docs, ZIP delivery | `.claude/rules/documentation-and-delivery.md` |

## Workflows

`/new-feature`, `/fix-issue`, `/review`, `/verify` live in `.claude/skills/`, with the on-request `/break-ui` and `/review-animations` beside them; subagents in `.claude/agents/`; hook scripts and what they enforce in `.claude/hooks/README.md`. Product documentation is in `docs/`, and `README.md` links to it.
