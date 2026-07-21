# app/components/CLAUDE.md

Scoped guidance for the whole `app/components/` tree. Conventions that apply to *every* source file — line-1 path comment, props style, auto-import reliance, `useButtonLogging` on interactive buttons, i18n keys in `i18n/locales/it.json`, toast patterns — live in the root `CLAUDE.md`; this file doesn't repeat them, it only covers what's specific to organizing components.

## Where does a new component go?

| Folder | What belongs there |
|--------|-------------------|
| `ui/` | Generic, domain-agnostic, reusable pieces (buttons, modal shells, tables, stat tiles, inputs). **Read [`ui/CLAUDE.md`](ui/CLAUDE.md) before adding anything here** — it's a maintained inventory kept specifically to prevent near-duplicates. |
| `layout/` | App chrome mounted from `app.vue`: logo, header actions, color-mode switch, logout, version badge. |
| `commander/`, `deck/`, `event/`, `league/`, `player/`, `ruleset/`, `standings/` | Domain-specific components, filename prefixed with the domain (`LeagueTable`, `PlayerCard`, `DeckHeader`, ...). `standings/` is a single-file domain folder (`StandingsCard.vue`) — same pattern as `player/`'s `PlayerNameTag.vue`: it lives under its own domain rather than a consumer's, because more than one domain reuses it (`/league/:id` and the event page share the exact same component, ADR-024 in `docs/PROGRESS.md`). |

Rule of thumb: if the component imports domain types (`Pairing`, `League`, ...) or talks to a domain store, it belongs in that domain's folder. If it could be lifted into an unrelated project unchanged, it belongs in `ui/`.

## Auto-import and naming

- `nuxt.config.ts` sets `pathPrefix: false`, so the component tag is just the filename regardless of nesting — `event/pairing/table/TableCard.vue` is `<TableCard>`. Two consequences:
  - **Base filenames must be unique across the entire tree**, even in different folders.
  - Moving a component between folders never breaks consumers — no import paths to update in templates.
- In `<script setup>`, rely on auto-imports for values (`ref`/`computed`, composables, `ICONS`, ...) — `vitest.config.ts` mirrors Nuxt's auto-imports so plain-mount tests compile the same way. Type imports and `#shared/` imports stay explicit; Nuxt runtime composables (`useToast`, ...) need per-test stubs. See the root `CLAUDE.md` for the full rule. Component imports *inside* `<script setup>` (e.g. `TableScoreGrid`'s `import TableSeatItem from '../TableSeatItem.vue'`) are still needed where the component is referenced in the template AND the file is mounted in tests — Nuxt's *component* auto-import resolver is not mirrored in vitest.

## `event/` substructure

The only domain folder with internal organization (everything else is flat):

- `modal/` — in-room round modals (score, scores summary, kill, commander, votes, next-round) plus `EventFormModal` (create/edit).
- `pairing/` — the pairing UI: `PairingsCard` (per-table cards during play) plus `kill/` (kill-flow canvas), `settings/` (optimizer weights, presets, forbidden pairs), and `table/` (table card pieces, with `table/preview/` for the drag-and-drop pairing preview modal and `table/score/` for the score-entry grid and its modals).
- `waiting/` — waiting-list registration table and stats.
- Loose files in `event/` root are event-page-level widgets (stepper, timers, control panel, ranking, header card).

Nesting is organizational only (tag names unaffected) — prefer adding to an existing subfolder over creating a new one for a single file.
