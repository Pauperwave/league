# app/composables/CLAUDE.md

Scoped guidance for `app/composables/`. See the root `CLAUDE.md` and `docs/architecture/state-flow.md` for the broader DB → store → composable → component picture.

## Auto-import — don't hand-write import statements for composables

`nuxt.config.ts` sets `imports: { dirs: ['~/composables/**'] }`, so every exported function here is auto-imported anywhere in `app/`, regardless of subfolder depth. Consequences:
- Don't add an `import { useXxx } from '~/composables/...'` for a value import inside `app/` — it's dead weight and drifts when files move.
- **Type-only imports still need an explicit `import type { ... } from '~/composables/path/to/file'`** — auto-import doesn't cover types. When you move a composable file, grep for `composables/<old-path>` before deleting the old location; type-only imports won't error until `nuxt typecheck` catches the missing module, and plain value auto-imports won't error at all if the export still exists somewhere in the tree (they'll just silently resolve to a stale/wrong file if there's a naming collision).
- **Never leave a re-export shim behind after moving a file** (a one-line file that does nothing but `export` everything from the file's new home). This project has no external consumers to stay compatible with — rename/delete cleanly and fix the (usually few, type-only) call sites. Several of these shims accumulated from past reorgs and were removed on 2026-07-12; don't reintroduce the pattern.

## Subfolder organization

| Folder | Contains |
|--------|----------|
| `event/` | Event page orchestration, lifecycle, URL sync, modals, presets |
| `event-pairing/` | The pairing optimizer (`pairingOptimizer.ts`) and preferences — canonical source, see its file-level comment on the scoring invariant before touching weights |
| `supabase/` | Thin SSR-friendly fetchers that wrap a store's fetch action in `useAsyncData` |
| `commanders/`, `players/`, `tables/`, `theme/`, `ui/`, `auth/`, `league/`, `deck/` | Feature-scoped composables |

A few composables live flat at the top of `app/composables/` (no subfolder) — that's fine for genuinely small one-off helpers, but if a composable grows a sibling (types, a preferences file, a test), give it a subfolder rather than letting the top level accumulate files.

## SSR composable pattern

Composables that fetch Supabase data wrap the corresponding store action in `useAsyncData`, and return `{ data, pending, error, refresh }` (or a subset):

```ts
export function useXxx(id: Ref<number | undefined>) {
  const store = useXxxStore() // or supabase directly for a narrow, store-independent query
  return useAsyncData(
    () => `xxx-scope-${id.value ?? 'none'}`,   // see docs/architecture/async-data-keys.md before inventing a new key
    async () => { /* fetch */ },
    { immediate: true, server: true, watch: [id] }
  )
}
```

Check `docs/architecture/async-data-keys.md` for the full key inventory before adding a new `useAsyncData` key — there's a documented collision history, and key format is `{domain}-{scope}-{id}`.

## Non-SSR composables

Orchestration composables (`useEventPage`, `useEventLifecycle`, `useEventModals`, etc.) don't call `useAsyncData` themselves — they compose store state and other composables' return values and are called once per page in `<script setup>`. If a composable's return value will be used in a template, destructure it fully at the call site rather than keeping the composable's return as one nested object (refs won't auto-unwrap through nesting).
