# Route Map

<!-- docs/routes.md -->

Complete inventory of all application routes.

## Public Routes

| Route | File | Description | Key Data |
|-------|------|-------------|----------|
| `/` | `pages/index.vue` | App root — navigation hub to leagues, players, decks, rulesets | None |
| `/login` | `pages/login.vue` | Authentication page | Supabase auth |

---

## League Routes

| Route | File | Description | Key Data |
|-------|------|-------------|----------|
| `/leagues` | `pages/leagues.vue` | List all leagues | `useLeagues()` |
| `/league/:id` | `pages/league/[id].vue` | League detail + event list + cross-event standings | `useLeague(id)`, `useEvents(leagueId)` |
| `/league/:leagueId/event/:eventId` | `pages/league/[leagueId]/event/[eventId].vue` | Event management page (registration, playing, ended) | `useEventPage()` |

### Event Page URL Query Params

The event page supports query parameters for modal state persistence:

| Param | Example | Purpose |
|-------|---------|---------|
| `phase` | `?phase=playing` | Override current phase |
| `round` | `?round=1` | Override current round |
| `preview` | `?preview=1` | Open table preview modal |
| `scoreModal` | `?scoreModal=1` | Open score modal |
| `killModal` | `?killModal=1` | Open kill system modal |
| `votesModal` | `?votesModal=1` | Open votes modal |
| `commanderModal` | `?commanderModal=1` | Open commander modal |

See `docs/modal-url-sync.md` for full documentation.

---

## Player Routes

| Route | File | Description | Key Data |
|-------|------|-------------|----------|
| `/players` | `pages/players/index.vue` | List all players with search + deck filter | `usePlayers()`, `useCommanderDecks()` |
| `/player/:slug` | `pages/player/[slug]/index.vue` | Player profile + stats + commander decks | `usePlayerStats(playerId)`, `useCommanderDecks(playerId)` |
| `/player/:slug/deck/:deckSlug` | `pages/player/[slug]/deck/[deckSlug].vue` | Player-specific deck statistics | `useDeckStats(playerId, commander1, commander2)` |

> **Note:** Slug is computed from `slugify("{name} {surname}")`. Example: `/player/alessandro-berti`.

---

## Deck Routes

| Route | File | Description | Key Data |
|-------|------|-------------|----------|
| `/decks` | `pages/decks/index.vue` | Browse all unique commanders (deduplicated) | `useCommanderDecks()`, `useCommanderAggregates()` |
| `/deck/:deckSlug` | `pages/deck/[deckSlug].vue` | Global commander stats across all players | `useCommanderStats(commander1, commander2?)` |

> **Player-specific vs global:**
> - `/player/:slug/deck/:deckSlug` → "How this player performs with this commander"
> - `/deck/:deckSlug` → "How all players perform with this commander"

---

## Ruleset Routes

| Route | File | Description | Key Data |
|-------|------|-------------|----------|
| `/rulesets` | `pages/rulesets.vue` | List all rulesets | `useRulesets()` |

---

## Route Relationships

```
/                           (root hub)
├── /leagues                (list)
│   └── /league/:id         (detail)
│       └── /league/:leagueId/event/:eventId  (event page)
│
├── /players                (list)
│   └── /player/:slug       (profile)
│       └── /player/:slug/deck/:deckSlug      (player deck stats)
│
├── /decks                  (browse all)
│   └── /deck/:deckSlug     (global commander stats)
│
├── /rulesets               (list)
│
└── /login                  (auth)
```

---

## Nested Route Gotchas

Nuxt file-based routing creates **parent-child relationships** when a directory and file share a path segment:

```
pages/player/[slug].vue        ← parent (requires <NuxtPage>)
pages/player/[slug]/index.vue   ← child
pages/player/[slug]/deck/[deckSlug].vue  ← child
```

**Problem:** If `player/[slug].vue` exists as a file, it becomes a parent route. The child pages only render if the parent contains `<NuxtPage>`.

**Solution:** Move the parent content to `player/[slug]/index.vue` and delete `player/[slug].vue`. This makes all three routes **independent**.

See the player profile refactor in git history for the full context.

---

## Dynamic Parameters

| Param | Type | Source | Example |
|-------|------|--------|---------|
| `:id` | `number` | Route params | `/league/150` → `id = 150` |
| `:leagueId` | `number` | Route params | `/league/150/event/227` → `leagueId = 150` |
| `:eventId` | `number` | Route params | `eventId = 227` |
| `:slug` | `string` | Route params | `/player/alessandro-berti` → `slug = "alessandro-berti"` |
| `:deckSlug` | `string` | Route params | `/deck/ellie-vengeful-hunter` → `deckSlug = "ellie-vengeful-hunter"` |

All numeric params are parsed via `parseInt()` in composables.

---

## Navigation Patterns

### Internal Links

- **Player names** → `PlayerNameTag` links to `/player/:slug`
- **Deck stats button** → `CommanderDeckCard` links to:
  - From player profile: `/player/:slug/deck/:deckSlug`
  - From `/decks` browse: `/deck/:deckSlug`
- **Event links** → `LeagueEventsPanel` links to `/league/:leagueId/event/:eventId`
- **League links** → `LeagueTable` links to `/league/:id`

### Programmatic Navigation

- `navigateTo({ path, query })` — preferred for URL construction with params
- `router.push()` — used in `useEventUrl.ts` for query sync

---

## Related Docs

- `docs/component-hierarchy.md` — Which components render on each route
- `docs/event-flow.md` — Event page state transitions
- `docs/modal-url-sync.md` — Query parameter behavior
