# app/stores/CLAUDE.md

Scoped guidance for `app/stores/`. See the root `CLAUDE.md` and `docs/architecture/state-flow.md` / `docs/architecture/stores.md` for the broader picture — this file only covers what you need to write or modify a store correctly.

## Two store categories — pick the right template

- **Supabase stores** (`leagues.ts`, `rulesets.ts`, `players.ts`, `player-stats.ts`, `events.ts`, `commander-decks.ts`): persistent data, own the DB round-trip.
- **Session stores** (`rankings.ts`, `kills.ts`, `votes.ts`, `commanders.ts`): ephemeral per-round UI state, no `supabase` calls, no `initialized`/`loading`. Must implement `reset()` (called between rounds — see `useEventLifecycle.ts`'s `resetSessionStores`).

## The store is the source of truth — `useAsyncData` is only an SSR bridge

There are two caching layers in the data flow (store `items` + `initialized` flags, and the `useAsyncData` key cache in the wrapping composables). Only the store is the source of truth. `useAsyncData` exists solely for SSR orchestration and request dedupe: **never read `data` from a `useAsyncData` return to render domain data — read the store's state.** Correspondingly, invalidation means the store's `force`/`fetch*` path, with the composable's `refresh()` only as the SSR-aware trigger for it. If a component renders from `data` instead of the store, the two caches can disagree and the bug will look like "stale data sometimes" — this is by-design guidance, not a style preference.

Don't blend the two patterns in one store. If a session store needs to persist (like `round_results` writes from rankings/kills/votes/commanders), that persistence goes through `useEventStore`'s `save*`/`upsertRoundResult`, not through the session store itself — see ADR-007 in `docs/PROGRESS.md`.

## Supabase store shape (copy `leagues.ts` as a template)

```ts
export const useXxxStore = defineStore('xxx', () => {
  const supabase = useSupabaseClient()

  const items = ref<Item[]>([])
  const error = ref<string | null>(null)
  const initialized = ref(false)          // or a loadingCount for stores with many nested async ops (see events.ts)
  const loadingFetch = ref(false)          // per-action flags, OR a single loadingCount — pick one, don't mix

  async function fetchItems(force = false) {
    if (initialized.value && !force) return
    loadingFetch.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase.from('xxx').select('*')
      if (err) throw err
      items.value = data ?? []
      initialized.value = true
    } catch (err) {
      error.value = toErrorMessage(err, 'Errore nel caricamento xxx')
      console.error('[useXxxStore] fetchItems error:', err)
    } finally {
      loadingFetch.value = false
    }
  }

  // mutating actions return { success: boolean, data?: T, error?: string } — never throw to the caller
  async function createItem(item: ItemInsert) { /* same try/catch/finally shape */ }

  return { items, error, loading, /* ... */ fetchItems, createItem }
})
```

Non-negotiable parts of this shape:
- `error.value = toErrorMessage(err, '<Italian fallback message>')` — always use `~/utils/error.ts`'s `toErrorMessage`, never `err.message` directly (it can be `unknown`).
- `console.error('[useXxxStore] actionName error:', err)` — the `[useXxxStore]` prefix is grepped for in practice; keep it exact.
- Mutating actions (`create`/`update`/`delete`) return `{ success, data?, error? }` and never throw — callers (pages/composables) check `.success`, they don't try/catch the store call.
- Local state is updated optimistically after a successful mutation (push/splice/filter on `items.value`), not by refetching.
- `initialized` (or `initialized: Record<key, boolean>` for per-scope stores like `useEventStore`) exists specifically to make repeated navigation to the same page cheap — `force` bypasses it.

`useEventStore` (`events.ts`) is the exception to "keep it simple": it's the largest store by far (full event lifecycle, pairing generation, round scoring) and uses a `loadingCount` instead of per-action booleans because operations nest. Read it before extending it, and prefer extracting a module-level helper function (see the top of the file for examples like `fetchRoundData`, `calculateRoundScores`) over adding more inline logic to an already-long action — pure functions get unit tests for free, inline store logic never does. Slimming it this way opportunistically (whenever an action is touched) is committed work: `docs/BACKLOG.md` #6.

## Session store shape (copy `kills.ts` as a template)

- State: `ref<T[]>` or `ref<Map<K,V>>`/`ref<Set<T>>`, no `supabase`, no `initialized`.
- **Mutate `Map`/`Set` state in place** (`map.set(...)`, `set.add(...)`, `map.clear()` in `reset()`) — Vue 3's reactive instrumentation covers Map/Set methods, so the old defensive `x.value = new Map(x.value)` copies after each mutation were redundant O(n) work and were removed on 2026-07-14 (ADR-012). Only `hydrate()` replaces the whole container (that's its job). Consequence for consumers: **never `watch(store.someMap)` by reference** — `hydrate()` (and array reassignments like `removeKill`) swap the object and orphan a reference-based watcher; always use the getter form `watch(() => store.someMap, fn, { deep: true })`.
- Getters that take arguments are `computed(() => (arg) => ...)`, not plain functions — this is what lets them stay reactive when used in templates.
- Mutating actions that can conflict (e.g. `addKill`) return `{ success, error? }` synchronously (no DB round-trip to await).
- Every session store ends with `reset()` that clears all its state — this is called on round transitions, not on component unmount.
- Every session store implements `hydrate(snapshot)` — the **single entry point for external data**. Today it's fed by `useSessionStorePersistence` (`app/composables/event/useSessionStorePersistence.ts`), which mirrors the four stores to localStorage (one key per event, round number embedded so round changes self-invalidate) as crash insurance against mid-round refreshes. When multi-player self-entry lands (`docs/BACKLOG.md` #2), a Supabase Realtime subscription will feed the same `hydrate()` seam — don't add other rehydration paths.

## Cross-store coordination

Stores never import or call each other directly. Orchestration happens one level up, in a composable or page (see `useEventPage.ts`, `useEventLifecycle.ts`). If you find yourself wanting `useEventStore` to call `usePlayerStore`, that logic belongs in a composable instead.
