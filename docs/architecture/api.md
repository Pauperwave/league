# API / CRUD Reference

<!-- docs/architecture/api.md -->

Entity-by-entity inventory of what's actually possible: which operations exist, which endpoint backs each one, and the deliberate gaps/asymmetries — the things that are easy to assume exist and don't, or assume are consistent across entities and aren't.

All reads are client → Supabase direct (anon key, `SELECT`-only RLS — see `database.md`), via a Pinia Colada `use*Query.ts` composable. All writes go through a `server/api/*` BFF endpoint using the service-role key (ADR-013/015, `database.md`) — there is no entity where the client writes to Supabase directly. Exact query keys for reads: `async-data-keys.md`.

## Leagues

| Op | Endpoint / composable | Notes |
|----|----|----|
| Create | `POST /api/leagues/create` | Server defaults `status: 'scheduled'`. |
| Read | `useLeaguesQuery()` (`['leagues']`), `useLeagueById` (derives from the same cached list, no per-id fetch) | |
| Update | `POST /api/leagues/:id/update` | |
| Delete | `POST /api/leagues/:id/delete` | **No in-use guard** — a league with events still gets a raw FK-violation 500 with the Postgres error message, not a friendly 409 like rulesets/decks below. |

## Rulesets

| Op | Endpoint / composable | Notes |
|----|----|----|
| Create | `POST /api/rulesets/create` | |
| Read | `useRulesetsQuery()` (`['rulesets']`) | |
| Update | `POST /api/rulesets/:id/update` | |
| Delete | `POST /api/rulesets/:id/delete` | **409** if the ruleset is in use by one or more leagues. |

## Players

| Op | Endpoint / composable | Notes |
|----|----|----|
| Create | `POST /api/players/create` | |
| Read | `usePlayersQuery()` (`['players']`), `usePlayerStats`/`useAllPlayerStats`, `usePlayerMatchHistory` | |
| Update | `POST /api/players/:id/update` | |
| Delete | **None.** | Deliberate — players are referenced throughout history/results (round_results, standings, pairings); there is no path, UI or API, to delete a player. |

## Commander Decks

| Op | Endpoint / composable | Notes |
|----|----|----|
| Create | `POST /api/decks/create` | |
| Read | `useDecksQuery()` (`['decks']`), `useCommanderDecks` (per-player + usage) | |
| Update | `POST /api/decks/:id/update` | |
| Delete | `POST /api/decks/:id/delete` | **409** if the deck (by commander name pair) has been played in an event's `round_results`. |

## Events

Events have both plain CRUD *and* a separate lifecycle state machine — don't conflate the two. Lifecycle detail (states, DB mutations per phase): `event-flow.md`.

| Op | Endpoint / composable | Notes |
|----|----|----|
| Create | `POST /api/events/create` | Starts in `registration`. |
| Read | `useEventsQuery(leagueId)` (`['events', leagueId]`), `useEventStandingsQuery`, `usePairingsQuery`, `usePairingHistoryQuery` | |
| Update | `POST /api/events/:id/update` | Form fields only (name/date/round count/round duration) — **not** a lifecycle transition. |
| Delete | `POST /api/events/:id/delete` | **No in-use guard**, same raw-FK-500 caveat as leagues. Related rows (standings/pairings/waitroom/round_results) follow DB FK behavior. |
| Start | `POST /api/events/:id/start` | Registration → playing. Validates 3+ waiting players (and not exactly 5), generates round-1 pairings from the confirmed player order. |
| Advance round | `POST /api/events/:id/advance-round` | Atomic: scores the closing round, accumulates standings, advances or ends the event, inserts next round's pairings. |
| Turn back round | `POST /api/events/:id/turn-back-round` | Rolls back one round, or back to registration from round 1 (restores the waitroom). |
| Register player | `POST /api/events/:id/register-player` | Adds to waitroom; body takes `playerIds: number[]` — already batchable, always call once with the full array, never loop. |
| Unregister player | `POST /api/events/:id/unregister-player` | Same shape — `playerIds: number[]` in one call. |

## Pairings

**No direct create/update/delete endpoint.** Pairings only ever come into existence as a side effect of `events/:id/start` (round 1) and `events/:id/advance-round` (round 2+) — there is no standalone "create a pairing" or "delete a pairing" API. Reads: `usePairingsQuery`/`usePairingHistoryQuery` above.

## Round results (rankings / kills / commander / votes)

Four narrow, single-purpose endpoints — not a generic round-result CRUD:

| Op | Endpoint | Notes |
|----|----|----|
| Save rankings | `POST /api/pairings/:pairingId/rankings` | |
| Save kills | `POST /api/pairings/:pairingId/kills` | |
| Save commander(s) | `POST /api/pairings/:pairingId/commander` | |
| Save votes | `POST /api/pairings/:pairingId/votes` | |

All four are upserts (by `pairing_id`+`player_id`) via `server/utils/roundResults.ts`'s shared `upsertRoundResult`, called from `useEventStore`'s `save*` actions (the ADR-007 seam) — never a store-owned local write. No delete: a round result is corrected by re-saving, not removed.

## Waitroom

Read/write both scoped to an event, not a standalone entity: see Events' register/unregister-player rows above and `useWaitroom(eventId)` for the read side (`['waitroom', eventId]`).

## Read-only tables (no write path exists, by design)

| Table | Read | Written by |
|-------|------|-----------|
| `player_stats` | `usePlayerStats`/`useAllPlayerStats` | DB trigger on `round_results` changes only |
| `deck_stats` | `useDeckStats` | DB trigger on `round_results` changes only |
| `commander_stats` (materialized view) | `useCommanderStats`/`useAllCommanderStats` | DB trigger refresh on `round_results` changes only |
| `mtg_commanders` | `useCommanderCards`/`useCommandersByNamesQuery` | Scryfall sync job, not the app |
| `standings` | `useEventStandingsQuery`/`useLeagueStandingsQuery`/`useMultipleEventStandingsQuery` | Only `events/:id/advance-round` (and rollback via `turn-back-round`) — never a direct standings-CRUD endpoint |

## Cross-cutting notes

- **No entity has client-side Supabase writes.** If you ever see `supabase.from(...).insert/update/delete(...)` inside `app/`, that's a regression — every write is `$fetch('/api/...')` to a BFF endpoint (ADR-013/015).
- **In-use delete guards are inconsistent.** Rulesets and decks get a friendly `409` with a clear message; leagues and events don't (raw DB error surfaces as a `500`). Worth aligning if this ever causes a confusing user-facing error.
- **Batch operations**: prefer one call with an array over a loop of single-item calls wherever the endpoint already accepts an array (`register-player`/`unregister-player` do; a caller looping over them one-by-one is a bug in the caller, not a missing feature — see the events waiting-list batch-remove fix, 2026-07-19).
