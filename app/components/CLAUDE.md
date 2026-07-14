# app/components/CLAUDE.md

Scoped guidance for the whole `app/components/` tree. Conventions that apply to *every* source file — line-1 path comment, inline `defineProps<{...}>()` with destructure defaults, explicit imports for everything in `<script setup>`, `useButtonLogging` on interactive buttons, i18n keys in `i18n/locales/it.json`, toast patterns — live in the root `CLAUDE.md`; this file doesn't repeat them, it only covers what's specific to organizing components.

## Where does a new component go?

| Folder | What belongs there |
|--------|-------------------|
| `ui/` | Generic, domain-agnostic, reusable pieces (buttons, modal shells, tables, stat tiles, inputs). **Read [`ui/CLAUDE.md`](ui/CLAUDE.md) before adding anything here** — it's a maintained inventory kept specifically to prevent near-duplicates. |
| `layout/` | App chrome mounted from `app.vue`: logo, header actions, color-mode switch, logout, version badge. |
| `commander/`, `deck/`, `event/`, `league/`, `player/`, `ruleset/` | Domain-specific components, filename prefixed with the domain (`LeagueTable`, `PlayerCard`, `DeckHeader`, ...). |

Rule of thumb: if the component imports domain types (`Pairing`, `League`, ...) or talks to a domain store, it belongs in that domain's folder. If it could be lifted into an unrelated project unchanged, it belongs in `ui/`.

## Auto-import and naming

- `nuxt.config.ts` sets `pathPrefix: false`, so the component tag is just the filename regardless of nesting — `event/pairing/table/TableCard.vue` is `<TableCard>`. Two consequences:
  - **Base filenames must be unique across the entire tree**, even in different folders.
  - Moving a component between folders never breaks consumers — no import paths to update in templates.
- Auto-import covers **template tags only**. Anything referenced in `<script setup>` (composables, `ICONS`, even `ref`/`computed`) still needs an explicit import — see the root `CLAUDE.md` for why (plain `@vue/test-utils` mounts bypass the auto-import transform).

## `event/` substructure

The only domain folder with internal organization (everything else is flat):

- `modal/` — in-room round modals (score, scores summary, kill, commander, votes, next-round) plus `EventFormModal` (create/edit).
- `pairing/` — the pairing UI: `PairingsCard` (per-table cards during play) plus `kill/` (kill-flow canvas), `settings/` (optimizer weights, presets, forbidden pairs), and `table/` (table card pieces, with `table/preview/` for the drag-and-drop pairing preview modal and `table/score/` for the score-entry grid and its modals).
- `standings/`, `waiting/` — standings card; waiting-list registration table and stats.
- Loose files in `event/` root are event-page-level widgets (stepper, timers, control panel, ranking, header card).

Nesting is organizational only (tag names unaffected) — prefer adding to an existing subfolder over creating a new one for a single file.
