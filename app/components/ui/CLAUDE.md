# app/components/ui/CLAUDE.md

> an inventory of reusable pieces whose whole value is "check here before hand-rolling a duplicate."

Scoped guidance for `app/components/ui/`. **Check this list before adding a new generic button/modal/layout piece here** — a near-duplicate (another hand-rolled cancel/confirm footer, another `<UButton color="primary">`) is the signal to reuse or extend one of these instead of hand-rolling. Organized into subfolders by family — component tag names are unaffected by the nesting (`nuxt.config.ts` sets `pathPrefix: false`), so `<CancelButton>` stays `<CancelButton>` regardless of which subfolder it lives in.

## Two separate button families — don't merge them

| Family | Location | Purpose | Shape |
|--------|----------|---------|-------|
| `RowActionButton` + `RowActionButtons` | `actions/` | Row/card-level CRUD actions (edit/view/delete) shown together as a compact icon button group in tables and cards | Config-driven off `ACTION_MAP`/`ActionType` (`app/utils/actionButton.ts`) — color, icon, and label are looked up from the action name, not passed inline |
| `CancelButton` + `ConfirmButton` | `modal/` | The cancel/primary pair in a modal footer | Standalone, each takes its own `label`/`loading`/`disabled` props directly — no shared config map, because the label is always call-site-specific (different modal, different action) |

These two families solve different problems (row action *group* vs. one modal's *footer pair*) and were kept deliberately separate rather than unified into one mega-button-config system — don't try to fold `CancelButton`/`ConfirmButton` into `ACTION_MAP` or vice versa. (`RowActionButton`/`RowActionButtons` were named that way — not `BaseButton`/`ActionButtons` — specifically so the name signals "this is for table row actions," not "this is the generic foundation for all buttons.")

- `CancelButton`: defaults to `t('common.cancel')` + trailing `ICONS.undo`, `color="neutral"`. Every modal footer shows this icon — `ModalFooterActions` used to pass `:show-icon="false"` for a plain-text look but that made its footers inconsistent with `FormModal`/`ConfirmModal`, so it was dropped (2026-07-13). Don't reintroduce `:show-icon="false"` without a specific reason.
- `ConfirmButton`: defaults to `t('common.confirm')`, `color="primary"`. Supports **two** trigger modes via `type`: `type="button"` (default, fires `@click`) for handler-based modals, or `type="submit"` + `:form="formId"` to trigger a native `<form id="...">` submit (used by `FormModal`) — this is why one component covers both `FormModal` and `ModalFooterActions` instead of needing a third variant.
- **Loading state on these wrappers is the explicit `:loading` prop, NOT `loading-auto`**: `ConfirmButton`/`CancelButton` re-emit `click` synchronously (for `useButtonLogging`), which breaks the promise chain `loading-auto` relies on — the inner `UButton` would see a void handler and never show the spinner. `loading-auto` is for bare `<UButton>`s with the async handler bound directly (see root `CLAUDE.md` "Async action buttons").

## Modal shells (`modal/`) — pick the one matching your modal's shape

- **`FormModal`** — the create/edit modal shell (title/icon/description header, footer with `CancelButton` + `ConfirmButton` wired to `type="submit"`/`:form`). Pairs with `useFormModalMeta` (`app/composables/ui/useFormModalMeta.ts`) for the `isEditing`-driven title/description/icon/submitLabel + cancel-logging boilerplate. Used by `LeagueFormModal`, `RulesetFormModal`, `CreatePlayerModal`, `EventFormModal`, `DeckCreateModal`, `DeckEditModal`.
- **`ModalFooterActions`** — just the footer row (`CancelButton` outline + `ConfirmButton`, both click-handler based) for modals that already have their own header/body markup and only need the cancel/confirm pair, not the full `FormModal` shell. Used by `EventCommanderModal`, `TableScoreGrid`, `TableScoreModal`.
- **`ConfirmModal`** — a distinct destructive-confirmation dialog (title/description/question/subject/warning, confirm+cancel with configurable icons) — not a `FormModal`/`ModalFooterActions` variant, it's for "are you sure you want to delete X" flows specifically.

If a new modal needs a title/body/footer shell and is a create-or-edit form → `FormModal`. If it already has bespoke header/body and just needs the button row → `ModalFooterActions`. If it's a delete/destructive confirmation → `ConfirmModal`. Don't hand-roll a fourth footer pattern — extend one of these three first.

### `defineEmits` payload types — export from the owning composable, never redeclare

A `FormModal`-based component's `create`/`update` payload is a real type, not a one-off inline shape — **export it from the composable that owns the mutation the payload feeds** (e.g. `DeckUpdatePayload` from `useDeckMutations.ts`, `LeagueFormPayload`/`LeagueUpdatePayload` from `useLeagueMutations.ts`, `PlayerUpdatePayload` from `usePlayerMutations.ts`, `EventCreatePayload`/`EventUpdatePayload` from `EventFormModal.vue` itself since events' mutation takes DB-shaped fields the modal has to transform first), then `import type` it at every consumer: the modal's own `defineEmits<{...}>()`, the page/composable handler that receives the emit, and the mutation's own parameter type. Never write out `{ id: number; data: { ... } }` (or similar) by hand a second time.

This was a real, shipped bug, not just style: `DeckEditModal.vue`'s `update` emit was typed `Partial<CommanderDeck>` while `useDeckMutations.ts`'s `updateDeck` mutation separately expected `Partial<DeckFormPayload>` — two hand-written types that happened to overlap enough to compile, so nothing caught them silently drifting apart. A one-line field rename in either type would have broken the other at runtime without a type error at the point of change. Exporting one canonical type turns that into a compile error at the actual point of change instead.

## Other pieces here

- **`actions/QuickFillButton`** — a dev-only "fill with test data" trigger (`tooltip`, `ariaLabel?`, `size?`, `@click`). Renders nothing unless the app-wide developer view (`useDeveloperView.ts`, toggled via `DeveloperViewToggle` in the header) is on — callers don't gate visibility themselves. Used by `PairingsCard.vue` (fill-all) and `TableCardActions.vue` (single table) specifically so both share one icon/color/variant instead of drifting apart, which is what happened before this was extracted (2026-07-21).
- **`layout/ListPageShell`** — the list-page chrome (breadcrumb, home/title/add header row, error alert, loading spinner, content slot, `#extra` slot for always-mounted modals). Used by `leagues.vue`/`rulesets.vue`. Only reuse for pages that share that exact `min-h-screen bg-default` list-page shape — `decks/index.vue`/`players/index.vue` have a different shell (`container mx-auto p-6 space-y-6` with an inline header row) and weren't forced into this one.
- **`display/StatTile`** — the icon + big-number + label tile repeated in stat grids (`icon`, `value`, `label`, optional `color`/`background`). Check here before hand-rolling another `flex items-center gap-3 p-3 rounded-lg` stat box.
- **`display/BaseTable`** — generic wrapper around `UTable` with a standard empty state (`emptyTitle`/`emptyDescription`/`emptyIcon`).
- **`display/ImageWithFallback`** — an `<img>` with a loading-spinner and missing-image fallback (`src`/`alt`/`loading`). Used by `CommanderArt.vue` (single image + name/mana overlay) and `CommanderArtGallery.vue` (1-2 images side by side, no overlay) — those two keep their own different wrapper/caption markup, only the inner image+fallback block is shared.
- **`input/DatePicker`** — `CalendarDate`-based date input wrapping `@internationalized/date`, not a raw `UInput`/native date picker.
