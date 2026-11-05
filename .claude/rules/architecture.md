# Architecture

Single-page, frontend-only app. Keep dependencies one-way:

```
app  ->  features/*  ->  stores, services, components, hooks, lib
```

## Boundaries (true today; keep them true)

- `src/lib/`, `src/components/`, and `src/hooks/` are feature-agnostic and import nothing from `features/`.
- `features/canvas` may import types, constants, and validation from `features/workspaces`. The reverse edge does not exist; keep it that way.
- `stores/` and `services/` consume only types, constants, and pure utils from features, never feature components or hooks.
- All storage access goes through the `StorageAdapter` and `ImageStorage` interfaces in `services/persistence/`. Components and stores never call `localStorage` or IndexedDB directly (the one exception is the UI-preferences `persist` middleware in `ui-store.ts`).

## Where new code lives

| Kind of code | Location |
| --- | --- |
| Rule or calculation (pure) | `features/<feature>/utils/<name>.ts` with a colocated `<name>.test.ts` |
| Type or model | `features/<feature>/types/` |
| Shared UI primitive | `components/ui/` |
| Feature component | `features/<feature>/components/` |
| Reusable effect or subscription | `features/<feature>/hooks/` (feature-specific) or `hooks/` (generic) |
| Persistence | `services/persistence/` behind an interface |
| Moving data in or out (export, import, restore) | `services/transfer/`; storage and the "add workspace" callback are parameters, so rollback is testable |
| Global preference | `stores/ui-store.ts` |

## Design decisions to preserve

- **Rules live in pure functions.** Components call them; they do not re-implement them. Group membership, connection validity, URL and tag normalization, and image validation each have one canonical function.
- **One canvas store per open editor**, created only after the saved canvas has been read and validated. Opening another workspace starts clean.
- **Commands are shared.** Buttons, shortcuts, and empty-state actions call the same functions in `useCanvasCommands`, so they cannot drift apart.
- **Replaceable persistence.** A future backend or sync layer implements the same adapter interfaces; UI code does not change.
- **Lazy heavy code.** The editor route and the Three.js scene are separate chunks. Keep imports of `three` and `@xyflow/react` out of the dashboard's static import graph.

## Module hygiene

- One concern per file. Review any file that grows past roughly 400 lines for extraction before adding more.
- A new abstraction needs a second concrete use. Prefer deleting a layer to polishing it.
- No circular imports. If two modules need each other, move the shared piece to a third.
