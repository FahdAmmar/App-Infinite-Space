# Third-party skills

Twelve skills in this folder come from open-source collections. The other four skills (`fix-issue`, `new-feature`, `review`, `verify`) were written for InfiniteSpace.

| Skill | Role in this project | Source | Commit | License |
| --- | --- | --- | --- | --- |
| `frontend-ui-engineering` | Accessible, responsive, production-quality UI work | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | `aeac41d` | MIT |
| `test-driven-development` | Red-green-refactor loop for rules, stores, and bug fixes | addyosmani/agent-skills | `aeac41d` | MIT |
| `debugging-and-error-recovery` | Root-cause method used by `fix-issue` | addyosmani/agent-skills | `aeac41d` | MIT |
| `code-review-and-quality` | Five-axis review used by `review` | addyosmani/agent-skills | `aeac41d` | MIT |
| `performance-optimization` | Measured optimization for large canvases and bundles | addyosmani/agent-skills | `aeac41d` | MIT |
| `security-and-hardening` | Input, storage, and dependency hardening | addyosmani/agent-skills | `aeac41d` | MIT |
| `incremental-implementation` | Thin-slice delivery used by `new-feature` | addyosmani/agent-skills | `aeac41d` | MIT |
| `animation-performance` | Frame-budget method for drag, pan, and entrance motion | [emilkowalski/skills](https://github.com/emilkowalski/skills) | `a81dbca` | MIT |
| `review-animations` | Strict motion review; runs only when the user types it | emilkowalski/skills | `a81dbca` | MIT |
| `break-ui` | Worst-case-data pass (long, Arabic, empty, huge); runs only when typed | emilkowalski/skills | `a81dbca` | MIT |
| `mobile-native` | Phone and touch fixes at 390 px | emilkowalski/skills | `a81dbca` | MIT |
| `webapp-testing` | Playwright helpers (`with_server.py`) for the `e2e/` flows | [anthropics/skills](https://github.com/anthropics/skills) | `dbd4588` | Apache-2.0 (`webapp-testing/LICENSE.txt`) |

The `addyosmani/agent-skills` and `anthropics/skills` snapshots were taken on 2026-10-22, and the `emilkowalski/skills` snapshot on 2026-10-30 (from the `claude-skills-bundle` archive, a shallow clone of the default branch). All will drift from upstream.

## Changes made to the imported files

- **Split to meet the 200-line Markdown limit.** The seven `addyosmani/agent-skills` skills were divided at section boundaries into a shorter `SKILL.md` plus files under `references/`; a "Reference material" table in each `SKILL.md` says when to read each file. A line-by-line comparison showed no original text removed (only the two old reference-file titles were replaced). `webapp-testing` is unchanged.
- **Project override.** A note under each skill title (and in reference files that run git commands) says to run no git command unless the user asks.
- **Shared checklists** from the same repository (`accessibility-checklist`, `definition-of-done`, `performance-checklist`, `security-checklist`, `testing-patterns`) sit in `.claude/references/`, where the skills' relative links expect them. The three over-long ones were split into `<name>.md` and `<name>-2.md`.
- Links were adjusted to the new file names.
- **Emil Kowalski skills.** `animation-performance` and `mobile-native` were split at section boundaries into a shorter `SKILL.md` plus files under `references/`; a comparison of non-blank lines showed no original text removed apart from each skill's `description`. Each of the four has a "Project override" note under its title that makes the project's motion, canvas, and no-git rules win. `break-ui` also gained `disable-model-invocation: true`, and its Phase 3 toggle is replaced by test fixtures (see its override note).
- **Descriptions narrowed to this app.** The `description` of `security-and-hardening` and `performance-optimization` now says the app has no backend, so they stop triggering on login, session, and database work. Their bodies and references are unchanged.

A few of these skills mention sibling skills that are not installed here (for example `browser-testing-with-devtools`, `constraint-driven-development`, `observability-and-instrumentation`, `git-workflow-and-versioning`). Those pointers are optional and can be ignored.

Treat the helper scripts under `webapp-testing/` as third-party code: read before running.

## Not included, on purpose

Skills from the supplied collections that were reviewed and left out: the Taste Skill family (it deals website art directions from a gallery library for landing pages, which would fight the reference-driven look in `styling-and-design.md`), Hallmark (new marketing pages and documents; its optional image script posts prompts to an external API, against the no-network rule), Impeccable (a design-director skill whose hooks run a downloaded native engine on every edit; see `docs/CLAUDE-CODE.md`), the other emilkowalski skills (`animate-expo` and `write-swift` target other platforms, `ask-sonner` covers a library the app does not use, `pick-ui-library` pushes new dependencies, and `animate`, `improve-animations`, `find-animation-opportunities`, `remove-animations`, `animation-vocabulary`, `apple-design`, `prototype`, and `emil-design-eng` overlap the deliberately small motion policy), the Caveman family (terse-output modes and a cost gateway), Graphify, and document-format skills (docx, pdf, pptx, xlsx). Overlapping workflow skills (`verification-before-completion`, `karpathy-guidelines`) were left out because `verify` and `CLAUDE.md` already cover them.

## MIT License (agent-skills, Copyright (c) 2025 Addy Osmani; emilkowalski/skills, Copyright (c) 2026 Emil Kowalski)

Copyright (c) 2025 Addy Osmani
Copyright (c) 2026 Emil Kowalski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
