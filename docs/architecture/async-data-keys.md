# Async Data Key Naming Convention

Reference guide for all `useAsyncData` and `useLazyAsyncData` keys used across the codebase. Following a consistent naming convention prevents key collisions that cause runtime warnings and stale data.

## Convention

All keys follow the pattern:

```
{domain}-{scope}-{id}
```

| Segment | Purpose | Examples |
|---------|---------|----------|
| **domain** | What is being fetched | `events`, `standings`, `players`, `commander-decks` |
| **scope** | How it is filtered or grouped | `by-league`, `by-event`, `by-player`, `by-commander`, `all` |
| **id** | The specific identifier (optional for global keys) | `150`, `227`, `alessandro-berti` |

### Rules

1. **Always use kebab-case** (lowercase with hyphens)
2. **Never use bare IDs** without domain + scope prefix — `events-150` is ambiguous; `events-by-league-150` is not
3. **Page-level fetches** should include the page name if they might collide with composables: `event-page-events-150`
4. **Global keys** (no ID) are allowed when there is truly only one instance: `players`, `leagues-list`
5. **Computed keys** (reactive) should use `computed()` so the key updates when the parameter changes

## Current Key Inventory

No `useAsyncData` keys remain — every domain has migrated to Pinia Colada (ADR-015); see the table below.

### Pinia Colada query keys (ADR-015)

Domains migrated to Pinia Colada use array query keys instead of `useAsyncData` keys — same collision rules apply, so register new ones here:

| Composable | Key | Invalidated by |
|-----------|-----|----------------|
| `league/useLeaguesQuery.ts` | `['leagues']` | `useLeagueMutations` |
| `ruleset/useRulesetsQuery.ts` | `['rulesets']` | `useRulesetMutations` |
| `deck/useDecksQuery.ts` | `['decks']` | `useDeckMutations` |
| `commanders/useCommanderDecks.ts` | `['deck-usage', playerId]` | `useDeckMutations` |
| `players/usePlayersQuery.ts` | `['players']` | `usePlayerMutations` |
| `event/useWaitroom.ts` | `['waitroom', eventId]` | `useWaitroomMutations` (+ manual refresh on start/turn-back) |
| `event/useEventQueries.ts` | `['events', leagueId]` | `event/useEventMutations` (CRUD, auto) + refresh after lifecycle transitions (useEventPage) |
| `event/useEventQueries.ts` | `['event-standings', eventId]` | refresh after round transitions (useEventPage) |
| `event/useEventQueries.ts` | `['pairings', eventId, round]` | invalidated after lifecycle transitions (useEventPage) |
| `event/useEventQueries.ts` | `['pairing-history', eventId]` | invalidated after lifecycle transitions (useEventPage) |
| `league/useLeagueStandingsQuery.ts` | `['league-standings', leagueId]` | `event/useEventMutations` (event delete changes the summed aggregate) |
| `league/useLeagueStandingsQuery.ts` | `['event-standings-multi', ids]` | read-only aggregate (EventRanking) |
| `players/usePlayerStats.ts` | `['player-stats', playerId]` | read-only |
| `players/usePlayerStats.ts` (all) | `['all-player-stats']` | read-only (players list page) |
| `players/usePlayerMatchHistory.ts` | `['player-match-history', playerId]` | read-only |
| `commanders/useDeckStats.ts` | `['deck-stats', playerId, commander1Name]` | read-only |
| `commanders/useCommanderStats.ts` | `['commander-stats', commander1Name]` | read-only |
| `commanders/useCommanderStats.ts` (all) | `['all-commander-stats']` | read-only (decks browse page, `/commanders` list page) |
| `commanders/useCommanderCards.ts` | `['commander-card', cardName]` | read-only (Scryfall card data) |
| `commanders/useCommanderCards.ts` (batch) | `['commanders-by-names', sortedNameSet]` | read-only (decks browse color/mana-cost sort) |
| `commanders/useCommanderCatalogQuery.ts` | `['commander-catalog']` | manual `refetch()` only (`CommanderModal.vue` refresh button) — `staleTime`/`gcTime` 30 days, see `docs/architecture/client-caching.md` |

### Pages

| Page | Key | Purpose |
|------|-----|---------|
| — | — | The league/event pages now rely entirely on Colada queries (ADR-015); no page-level `useAsyncData` keys remain. |

## Collision History

| Collision | Cause | Fix |
|-----------|-------|-----|
| `events-150` | `useEvents` composable vs. `useAsyncData` in `[eventId].vue` | Renamed page key to `event-page-events-150` |

## Adding New Keys

When adding a new `useAsyncData` call, ask:

1. Is there already a composable that fetches this data? If yes, use the composable instead of a new `useAsyncData` call.
2. Could another component or page use the same key with a different handler? If yes, add scope + page prefix.
3. Is the key reactive? If yes, wrap it in `computed(() => ...)`.

## Example

```ts
// ❌ Ambiguous — could collide with a composable
useAsyncData(`events-${leagueId}`, fetchEvents)

// ✅ Explicit scope — no collision risk
useAsyncData(`events-by-league-${leagueId}`, fetchEvents)

// ✅ Page-level prefix — even safer when calling from a page
useAsyncData(`event-page-events-${leagueId}`, fetchEvents)
```
