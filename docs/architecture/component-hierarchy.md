# Component Hierarchy

<!-- docs/architecture/component-hierarchy.md -->

Maps which components compose each page and their nesting structure.

## Page: `/` (Root)

```
index.vue
└── UButton (×5) — navigation links to /leagues, /players, /decks, /commanders, /rulesets
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
├── PlayersTable
│   ├── PlayerNameTag
│   └── UBadge (×N)           — deck count / commander names
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
├── DeckHeader                — commander name + ManaCost + companion badge
├── Solo-stats links (UButton ×1-2)  → /commander/:commanderSlug (per half of the pair, BACKLOG #10)
├── CommanderArtGallery       — art for commander_1 (+ commander_2 if paired)
├── DeckStatsRow              — 5 metrics from useCommanderStats
├── Players Using This Deck:
│   └── UButton (per deck)    → /player/:slug/deck/:deckSlug
│       └── PlayerNameTag     — avatar + name, non-linkable (wrapping UButton already links)
└── ScryfallLinkButton
```

---

## Page: `/commanders`

```
commanders/index.vue
├── UBreadcrumb
├── PageHeaderRow
│   └── UInput                — client-side name search
└── BaseTable                 — sortable, one row per distinct commander name (card-level, not pair)
    ├── manaCost column        — ManaCost, or USkeleton while the catalog query is still loading
    ├── name column            — NuxtLink → /commander/:commanderSlug
    └── playerCount/matchCount/winCount/totalKills/averageScore columns
```

Data: `useAllCommanderStats()` (small, gates the page's loading state) + `useCommanderCatalogQuery()` (large, ~800KB — loads in the background, only the manaCost column waits on it via a per-cell `USkeleton`, see that composable's file comment).

---

## Page: `/commander/:commanderSlug`

```
commander/[commanderSlug].vue
├── UBreadcrumb
├── Commander header: name, art (CommanderArtGallery), mana cost
├── Stats bar (from useSingleCommanderStats — summed across every pair this card has appeared in)
├── BaseChart                 — win-rate donut (winRateOption), only rendered when matchCount > 0
└── Decks Featuring This Commander:
    └── NuxtLink per deck      → /deck/:deckSlug (through the deck's own commander_1 slug)
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
| `PlayerNameTag` | `name`, `surname`, `showAvatar?`, `linkable?`, `avatarSize?` | StandingsCard, PairingsCard, Rankings, LeagueStandingsCard, deck pages, KillPlayerNode |
| `ManaCost` | `manaCost` (string), `size?` | CommanderDeckCard, deck pages, `/commanders` list |
| `CommanderArt` | `cardName`, `artUrl`, `manaCost`, `loading` | `CommanderDeckCard` (browse grid) |
| `CommanderArtGallery` | `image1`, `image1Alt`, `hasPartner?`, `image2?`, `image2Alt?`, `loading?` | `/deck/:deckSlug`, `/commander/:commanderSlug` — 1 or 2 panes via `ImageWithFallback` |
| `BaseChart` | `option` (`ECOption`), `height?`, `loading?` | `/commander/:commanderSlug` win-rate chart (thin `vue-echarts` wrapper, `useChartTheme()` for dark/light colors) |

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

Domain folders are all lowercase (see `app/components/CLAUDE.md`); tag names drop the folder prefix entirely (`pathPrefix: false`), so e.g. `event/pairing/table/TableCard.vue` is just `<TableCard>`.

```
app/components/
├── charts/
│   └── BaseChart.vue            — thin vue-echarts wrapper (option/height/loading props)
├── commander/
│   ├── CardPreview.vue          — hover card image preview
│   ├── CommanderArt.vue         — single Scryfall card art (used by CommanderDeckCard)
│   ├── CommanderDeckCard.vue    — deck display card (reused across pages)
│   ├── CommanderModal.vue       — commander selector modal
│   ├── CommanderSearch.vue      — commander autocomplete input
│   └── ManaCost.vue             — colored mana symbols
├── deck/
│   ├── CommanderArtGallery.vue  — 1-2 pane art gallery (deck + single-commander pages)
│   ├── DeckCardActions.vue
│   ├── DeckCreateModal.vue
│   ├── DeckEditModal.vue
│   ├── DeckHeader.vue
│   ├── DeckNotFound.vue
│   ├── DeckPlayVotesModal.vue
│   ├── DeckStatsRow.vue
│   └── ScryfallLinkButton.vue
├── event/                        — event page components
│   ├── CurrentTime.vue
│   ├── EndedEventBadge.vue
│   ├── EventControlPanel.vue
│   ├── EventHeaderCard.vue
│   ├── EventRanking.vue
│   ├── EventStepper.vue
│   ├── EventTable.vue
│   ├── RoundTimer.vue
│   ├── StartEventButton.vue
│   ├── TimerControlButton.vue
│   ├── WinnerChecklist.vue
│   ├── modal/                    — in-room round modals + event CRUD
│   │   ├── EventCommanderModal.vue
│   │   ├── EventFormModal.vue
│   │   ├── EventKillModal.vue
│   │   ├── EventScoreModal.vue
│   │   ├── EventScoresModal.vue
│   │   ├── EventVotesModal.vue
│   │   └── NextRoundModal.vue
│   ├── pairing/                  — pairing UI
│   │   ├── PairingsCard.vue
│   │   ├── PairingsFullscreenView.vue
│   │   ├── kill/                 — kill-flow canvas
│   │   │   ├── KillFlowCanvas.vue
│   │   │   ├── KillLoopbackEdge.vue
│   │   │   ├── KillPlayerNode.vue
│   │   │   └── KillSystemModal.vue
│   │   ├── settings/             — optimizer weights, presets, forbidden pairs
│   │   │   ├── ForbiddenPairsSection.vue
│   │   │   ├── PairingPresetButtons.vue
│   │   │   ├── PairingSettingsModal.vue
│   │   │   └── PairingWeightsSection.vue
│   │   └── table/                — table card pieces
│   │       ├── PairingPlayerRow.vue
│   │       ├── PairingTableActions.vue
│   │       ├── TableCard.vue
│   │       ├── TableCardActions.vue
│   │       ├── TablePlayerReceiptCard.vue
│   │       ├── TableReceiptSummary.vue
│   │       ├── TableSeatItem.vue
│   │       ├── TableStateBadge.vue
│   │       ├── preview/          — drag-and-drop pairing preview modal
│   │       │   ├── TablePreviewGrid.vue
│   │       │   ├── TablePreviewModal.vue
│   │       │   └── TablePreviewToolbar.vue
│   │       └── score/            — score-entry grid and its modals
│   │           ├── TableScoreBreakdownModal.vue
│   │           ├── TableScoreGrid.vue
│   │           ├── TableScoreModal.vue
│   │           ├── TableScoresModal.vue
│   │           └── TableScoreTeamRow.vue
│   ├── standings/
│   │   └── StandingsCard.vue
│   └── waiting/
│       ├── WaitingList.vue
│       ├── WaitingListStats.vue
│       └── WaitingListTable.vue
├── layout/                        — app chrome mounted from app.vue
│   ├── AppLogo.vue
│   ├── ColorModeSwitch.vue
│   ├── DeveloperViewToggle.vue
│   ├── HeaderActions.vue
│   ├── LogoutButton.vue
│   └── VersionBadge.vue
├── league/
│   ├── LeagueEventsPanel.vue
│   ├── LeagueFormModal.vue
│   ├── LeagueRanking.vue
│   ├── LeagueStandingsCard.vue
│   ├── LeaguesUsingRulesetModal.vue
│   └── LeagueTable.vue
├── player/
│   ├── CreatePlayerModal.vue
│   ├── PlayerActiveFilterSwitch.vue
│   ├── PlayerDecksSection.vue
│   ├── PlayerFilterSwitch.vue
│   ├── PlayerMatchHistoryTable.vue
│   ├── PlayerNameTag.vue
│   ├── PlayerProfileHeader.vue
│   ├── PlayerSearchModal.vue
│   ├── PlayersEmptyState.vue
│   ├── PlayersHeader.vue
│   ├── PlayersTable.vue
│   └── PlayersToolbar.vue
├── ruleset/
│   ├── RulesetFieldGrid.vue
│   └── RulesetFormModal.vue
└── ui/                            — generic, domain-agnostic pieces (see ui/CLAUDE.md)
    ├── actions/
    │   ├── QuickFillButton.vue
    │   ├── RowActionButton.vue
    │   └── RowActionButtons.vue
    ├── display/
    │   ├── BaseTable.vue
    │   ├── ImageWithFallback.vue
    │   └── StatTile.vue
    ├── input/
    │   └── DatePicker.vue
    ├── layout/
    │   ├── ListPageShell.vue
    │   └── PageHeaderRow.vue
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
