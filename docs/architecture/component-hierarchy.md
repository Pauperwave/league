# Component Hierarchy

<!-- docs/component-hierarchy.md -->

Maps which components compose each page and their nesting structure.

## Page: `/` (Root)

```
index.vue
└── UButton (×4) — navigation links to /leagues, /players, /decks, /rulesets
```

---

## Page: `/leagues`

```
leagues.vue
└── LeagueTable          — leagues list with actions
    ├── LeagueFormModal   — create/edit league
    └── ConfirmModal      — delete confirmation
```

---

## Page: `/league/:id`

```
league/[id].vue
├── UBreadcrumb
├── LeagueEventsPanel     — event list + create button
│   └── EventFormModal    — create event
├── LeagueStandingsCard   — cross-event standings
│   └── PlayerNameTag     — linked player names
├── EventFormModal        — edit event
├── LeagueFormModal       — edit league
└── ConfirmModal          — delete confirmation
```

---

## Page: `/league/:leagueId/event/:eventId`

The most complex page. Components are auto-imported by Nuxt.

```
event/[eventId].vue
├── UBreadcrumb
├── EventControlPanel           — stepper + action buttons
│   ├── EventStepper            — visual phase indicator
│   ├── StartEventButton        — enabled when canStartEvent
│   └── NextRoundModal          — confirm round advance
├── EventHeaderCard             — event name, date, status badge
│   └── EndedEventBadge         — shown when event ended
├── WaitingList                 — registration phase only
│   ├── WaitingListTable        — sortable player table
│   ├── WaitingListStats        — player count + table estimate
│   └── PlayerSearchModal       — add existing player
│       └── CreatePlayerModal   — create + add new player
├── StandingsCard               — shown in registration + playing
│   └── PlayerNameTag           — linked names
├── PairingsCard                — playing phase only
│   ├── TableStateBadge         — "Completato" / "In corso"
│   ├── PlayerNameTag           — per-player name
│   └── TableCardActions        — view scores / reset / quick fill
└── Modals (conditionally rendered):
    ├── TablePreviewModal       — preview tables before start
    │   ├── TablePreviewToolbar
    │   └── TablePreviewGrid
    │       └── TableCard
    │           └── TableSeatItem
    ├── ConfirmModal            — generic confirmations (×2)
    ├── UModal + TableScoreGrid — score entry
    ├── UModal + CommanderModal — commander selection
    ├── UModal + TableScoresModal — view all table scores
    ├── UModal + TableScoreBreakdownModal — score breakdown
    ├── KillSystemModal         — kill flow visualization
    │   └── KillFlowCanvas
    │       └── KillPlayerNode
    ├── DeckPlayVotesModal      — brew + play votes
    ├── EventFormModal          — edit event
    └── PairingSettingsModal    — pairing algorithm settings
        ├── ForbiddenPairsSection
        ├── PairingWeightsSection
        └── PairingPresetButtons
```

---

## Page: `/players`

```
players/index.vue
├── UBreadcrumb
├── UInput                    — search by name
├── USwitch                   — "Solo con mazzi" filter
├── Player list (grid):
│   ├── UAvatar
│   ├── PlayerNameTag
│   └── PlayerDeckCount       — deck count badge
├── Empty states (×3):
│   ├── search-x icon          — no search results
│   ├── layers icon            — no decks filter active
│   └── users icon             — no players at all
├── CreatePlayerModal
└── CreatePlayerModal (inline) — toast confirmation
```

---

## Page: `/player/:slug`

```
player/[slug]/index.vue
├── UBreadcrumb
├── Profile Header:
│   ├── UAvatar
│   └── Player name + ID
├── Stats bar (6 metrics):
│   ├── UIcon ×6             — calendar, swords, trophy, skull, star, shield
│   └── Values from usePlayerStats
├── Commander Decks Section:
│   └── CommanderDeckCard (grid)
│       ├── DeckCardActions   — edit / delete (showActions only)
│       ├── CommanderArt      — card image with overlay
│       │   └── ManaCost      — colored mana symbols
│       └── Footer:
│           ├── companion info
│           └── lender info (borrowed decks)
├── DeckEditModal
├── DeckCreateModal
└── ConfirmModal              — delete deck confirmation
```

---

## Page: `/player/:slug/deck/:deckSlug`

```
player/[slug]/deck/[deckSlug].vue
├── UBreadcrumb
├── Deck Header:
│   ├── Commander name + ManaCost
│   └── UBadge (companion)
├── Stats bar (5 metrics from useDeckStats)
├── Card Art Gallery:
│   └── CommanderArt          — single or partner stack
└── "Vedi su Scryfall" link
```

---

## Page: `/decks`

```
decks/index.vue
├── Page header:
│   ├── USegment              — sort mode selector
│   └── UButton               — sort direction toggle
├── CommanderDeckCard (grid)   — aggregate mode (no player actions)
│   └── UBadge ×2             — player count, match count
└── Empty state
```

---

## Page: `/deck/:deckSlug`

```
deck/[deckSlug].vue
├── UBreadcrumb
├── Deck Header:
│   ├── Commander name + ManaCost
│   └── UBadge (companion)
├── Stats bar (5 metrics from useCommanderStats)
├── Card Art Gallery:
│   └── CommanderArt
├── Owner List:
│   └── NuxtLink per owner     → /player/:slug
└── "Vedi su Scryfall" link
```

---

## Page: `/rulesets`

```
rulesets.vue
└── LeagueTable               — similar to /leagues but for rulesets
    ├── RulesetFormModal      — create/edit
    └── LeaguesUsingRulesetModal
```

---

## Reusable Components

### Data Display

| Component | Props | Used By |
|-----------|-------|---------|
| `PlayerNameTag` | `name`, `surname`, `showAvatar?` | StandingsCard, PairingsCard, Rankings, LeagueStandingsCard |
| `ManaCost` | `manaCost` (string), `size?` | CommanderDeckCard, deck pages |
| `CommanderArt` | `cardName`, `artUrl`, `manaCost`, `loading` | CommanderDeckCard, deck detail pages |
| `PlayerDeckCount` | `playerId` | players/index.vue |

### Cards

| Component | Purpose |
|-----------|---------|
| `CommanderDeckCard` | Deck display (player profile or aggregate browse) |
| `LeagueStandingsCard` | Cross-event standings table |
| `EventRanking` | Single event ranking view |
| `LeagueRanking` | League-level ranking view |

### Modals (Generic)

| Component | Purpose |
|-----------|---------|
| `ConfirmModal` | Generic confirm/cancel with subject text |
| `EventFormModal` | Create/edit event |
| `LeagueFormModal` | Create/edit league |
| `RulesetFormModal` | Create/edit ruleset |
| `CreatePlayerModal` | Create new player |
| `PlayerSearchModal` | Search and add existing player |
| `DeckEditModal` | Edit borrowed deck status |
| `DeckCreateModal` | Create new commander deck |

### Modals (Event-Specific)

| Component | Trigger | Purpose |
|-----------|---------|---------|
| `TablePreviewModal` | "Anteprima Tavoli" | Preview table assignments before start |
| `NextRoundModal` | "Prossimo Round" | Confirm + preview next round |
| `TableScoreGrid` | Click pairing card | Enter scores per player |
| `TableScoresModal` | "Visualizza punteggi" | View submitted scores |
| `TableScoreBreakdownModal` | Score detail icon | Show point breakdown |
| `CommanderModal` | Commander selector | Pick commander for a player |
| `KillSystemModal` | Kill flow button | Visualize kill graph |
| `DeckPlayVotesModal` | Votes button | Cast brew + play votes |
| `PairingSettingsModal` | Settings gear | Configure optimizer weights |

### UI Primitives

| Component | Purpose | Notes |
|-----------|---------|-------|
| `BaseTable` | Generic data table | Used by Rankings |
| `RowActionButton` | Wrapper around UButton | Consistent styling |
| `RowActionButtons` | Button group layout | League/event actions |
| `CancelButton` | Styled cancel button | Modal dismiss |
| `DatePicker` | Date selection | Event form |
| `CardPreview` | Card hover preview | Commander search |
| `CommanderSearch` | Autocomplete commander | Deck create/edit |

### Layout

| Component | Location |
|-----------|----------|
| `AppLogo` | Header (commented out) |
| `HeaderActions` | Header right side (commented out) |
| `ColorModeSwitch` | Header |
| `LogoutButton` | Header |

---

## Component Directory Structure

```
app/components/
├── CommanderArt.vue           — Scryfall card art with gradient overlay
├── CommanderDeckCard.vue        — Deck display card (reused across pages)
├── CommanderSearch.vue          — Commander autocomplete input
├── DeckCardActions.vue          — Edit/delete buttons for deck card
├── ManaCost.vue                 — Colored mana symbols
├── PlayerDeckCount.vue          — Deck count badge
├── PlayerNameTag.vue            — Avatar + linked name
├── CardPreview.vue              — Hover card image preview
├── modals/                      — Generic form modals
│   ├── CommanderModal.vue
│   ├── CreatePlayerModal.vue
│   ├── DeckCreateModal.vue
│   ├── DeckEditModal.vue
│   ├── DeckPlayVotesModal.vue
│   ├── EventFormModal.vue
│   ├── LeagueFormModal.vue
│   ├── PlayerSearchModal.vue
│   ├── RulesetFormModal.vue
│   └── LeaguesUsingRulesetModal.vue
├── events/                      — Event page components
│   ├── EndedEventBadge.vue
│   ├── EventControlPanel.vue
│   ├── EventHeaderCard.vue
│   ├── EventStepper.vue
│   ├── LeagueEventsPanel.vue
│   ├── NextRoundModal.vue
│   ├── RoundTimer.vue
│   ├── StartEventButton.vue
│   ├── Pairings/
│   │   ├── PairingsCard.vue
│   │   ├── TableStateBadge.vue
│   │   ├── TableCardActions.vue
│   │   ├── TableScoreGrid.vue
│   │   ├── Kill/
│   │   │   ├── KillFlowCanvas.vue
│   │   │   ├── KillPlayerNode.vue
│   │   │   └── KillSystemModal.vue
│   │   ├── Settings/
│   │   │   ├── ForbiddenPairsSection.vue
│   │   │   ├── PairingPresetButtons.vue
│   │   │   ├── PairingSettingsModal.vue
│   │   │   └── PairingWeightsSection.vue
│   │   └── Table/
│   │       ├── TableCard.vue
│   │       ├── TablePlayerReceiptCard.vue
│   │       ├── TablePreviewGrid.vue
│   │       ├── TablePreviewModal.vue
│   │       ├── TablePreviewToolbar.vue
│   │       ├── TableReceiptSummary.vue
│   │       ├── TableScoreBreakdownModal.vue
│   │       ├── TableScoresModal.vue
│   │       ├── TableScoreModal.vue
│   │       └── TableSeatItem.vue
│   ├── Standings/
│   │   └── StandingsCard.vue
│   └── Waiting/
│       ├── WaitingList.vue
│       ├── WaitingListStats.vue
│       └── WaitingListTable.vue
├── Rankings/
│   ├── EventRanking.vue
│   ├── LeagueRanking.vue
│   └── LeagueStandingsCard.vue
├── Tables/
│   ├── EventTable.vue
│   └── LeagueTable.vue
├── Layout/
│   ├── AppLogo.vue
│   ├── ColorModeSwitch.vue
│   ├── HeaderActions.vue
│   └── LogoutButton.vue
└── ui/
    ├── actions/
    │   ├── RowActionButton.vue
    │   └── RowActionButtons.vue
    ├── display/
    │   ├── BaseTable.vue
    │   └── StatTile.vue
    ├── input/
    │   └── DatePicker.vue
    ├── layout/
    │   └── ListPageShell.vue
    └── modal/
        ├── CancelButton.vue
        ├── ConfirmButton.vue
        ├── ConfirmModal.vue
        ├── FormModal.vue
        └── ModalFooterActions.vue
```

---

## Auto-Import Convention

All components in `app/components/` are **auto-imported** by Nuxt. No explicit `import` needed in pages.

Exception: Components used in composables or non-Vue files must be imported explicitly.
