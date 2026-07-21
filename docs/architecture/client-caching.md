# Client-side caching

<!-- docs/architecture/client-caching.md -->

Two independent mechanisms write to `localStorage` in this app. They solve different problems, use different keys, and never interact — this doc exists so the distinction doesn't have to be re-derived from source every time.

| | Pinia Colada cache persister | `getCached`/`setCached` |
|---|---|---|
| File | `colada.options.ts` (plugin config) | `app/utils/localStorage.ts` |
| What it stores | The entire Colada query cache (server data pulled via `useQuery`) | 3 unrelated slices of local UI/session state (see below) |
| Storage key(s) | One key, `'league-colada-cache'` | One key per caller+scope: `event-session-${eventId}`, waiting-list flags per event, `winner-checklist-${eventId}-${round}` |
| Write trigger | Automatic, debounced (1s), whenever any query's cache entry changes | Explicit `setCached()` call on every relevant mutation/toggle |
| Read/restore | Automatic on app boot (plugin hydrates the Colada cache before queries run) | Explicit `getCached()` call in each composable's `onMounted()`, each with its own TTL |
| Problem it solves | *Pull-based* query caching: re-fetch avoidance + reload resilience for data read from Supabase | *Mirroring* mutable local state that has no query behind it (in-progress round entry, not yet submitted) |

## Pinia Colada cache persister

`@pinia/colada-plugin-cache-persister` (official plugin, ADR-015's Colada already in use) persists **every** `useQuery` cache entry to `localStorage`, not just one domain. `colada.options.ts` deliberately has no `filter` — see the comment there for why: this app is used live at in-person tournaments on often-unreliable venue wifi, and most Colada queries (standings, pairings, etc.) use Colada's short default `staleTime` (5s) / `gcTime` (5min). Persisting them doesn't prevent a refetch — one still fires almost immediately — but it means:

- A reload shows the last-known data **instantly** instead of a blank/loading state.
- If the refetch fails (no connectivity), the last-known-good data stays visible instead of an error.

One query is the deliberate exception: `useCommanderCatalogQuery()` (`app/composables/commanders/useCommanderCatalogQuery.ts`) sets `staleTime`/`gcTime` to 30 days, because the commander catalog (used by the whitelist/partner-filtering logic and the commander search autocomplete) only changes after a Scryfall resync or a manual DB correction — see that file's `CATALOG_CACHE_TIME` comment. For this one query, persistence is the main point (avoid re-fetching a near-static ~3000-row catalog on every commander-modal open), not just reload resilience.

A manual refresh button (`CommanderModal.vue`, `refetch()` from `useCommanderWhitelists`) exists specifically because this query's `staleTime` is long enough that a real catalog update wouldn't otherwise surface until the month-long window expires.

## `getCached`/`setCached`

This is the older, narrower mechanism (`app/utils/localStorage.ts`) — a plain TTL-wrapped `localStorage.getItem`/`setItem` pair, not a query cache. Three callers, all mirroring mutable local/UI state that has no query behind it:

- `useSessionStorePersistence.ts` (`app/composables/event/useSessionStorePersistence.ts`) mirrors the 4 session stores (rankings/kills/votes/commanders — see [`stores.md`](stores.md)) to `localStorage` on every mutation, keyed per event, and restores them via each store's `hydrate()` if the round number still matches on mount. Crash insurance for in-progress round entry that hasn't been submitted to the DB yet.
- `useWaitingListFlags.ts` persists the waiting-list paid/companion checkbox flags per event.
- `useWinnerChecklist.ts` (BACKLOG #15) persists the "booster consegnato" check-off state per event+round — winners themselves are derived live from `rankingsStore`, only the hand-off checkbox is mirrored here.

All three read in `onMounted()` rather than synchronously, to avoid an SSR hydration mismatch (a synchronous `localStorage` read at setup-time would make the server-rendered value disagree with the client's real one). There is no Supabase query behind any of them, so Colada doesn't apply.

**Do not consolidate these two.** They were evaluated together (see `docs/PROGRESS.md` for the ADR) and kept separate because the problem shapes differ: one is pull-based query caching of server data (Colada's whole reason to exist), the other is a bidirectional mirror of mutable local state with no fetch involved.
