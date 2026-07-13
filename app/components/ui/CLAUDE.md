# app/components/ui/CLAUDE.md

Scoped guidance for `app/components/ui/`. **Check this list before adding a new generic button/modal/layout piece here** — a near-duplicate (another hand-rolled cancel/confirm footer, another `<UButton color="primary">`) is the signal to reuse or extend one of these instead of hand-rolling. Organized into subfolders by family — component tag names are unaffected by the nesting (`nuxt.config.ts` sets `pathPrefix: false`), so `<CancelButton>` stays `<CancelButton>` regardless of which subfolder it lives in.

## Two separate button families — don't merge them

| Family | Location | Purpose | Shape |
|--------|----------|---------|-------|
| `RowActionButton` + `RowActionButtons` | `actions/` | Row/card-level CRUD actions (edit/view/delete) shown together as a compact icon button group in tables and cards | Config-driven off `ACTION_MAP`/`ActionType` (`app/utils/actionButton.ts`) — color, icon, and label are looked up from the action name, not passed inline |
| `CancelButton` + `ConfirmButton` | `modal/` | The cancel/primary pair in a modal footer | Standalone, each takes its own `label`/`loading`/`disabled` props directly — no shared config map, because the label is always call-site-specific (different modal, different action) |

These two families solve different problems (row action *group* vs. one modal's *footer pair*) and were kept deliberately separate rather than unified into one mega-button-config system — don't try to fold `CancelButton`/`ConfirmButton` into `ACTION_MAP` or vice versa. (`RowActionButton`/`RowActionButtons` were named that way — not `BaseButton`/`ActionButtons` — specifically so the name signals "this is for table row actions," not "this is the generic foundation for all buttons.")

- `CancelButton`: defaults to `t('common.cancel')` + trailing `ICONS.undo`, `color="neutral"`. Pass `variant="outline"` + `:show-icon="false"` to match a plain-text look (e.g. inside `ModalFooterActions`).
- `ConfirmButton`: defaults to `t('common.confirm')`, `color="primary"`. Supports **two** trigger modes via `type`: `type="button"` (default, fires `@click`) for handler-based modals, or `type="submit"` + `:form="formId"` to trigger a native `<form id="...">` submit (used by `FormModal`) — this is why one component covers both `FormModal` and `ModalFooterActions` instead of needing a third variant.

## Modal shells (`modal/`) — pick the one matching your modal's shape

- **`FormModal`** — the create/edit modal shell (title/icon/description header, footer with `CancelButton` + `ConfirmButton` wired to `type="submit"`/`:form`). Pairs with `useFormModalMeta` (`app/composables/ui/useFormModalMeta.ts`) for the `isEditing`-driven title/description/icon/submitLabel + cancel-logging boilerplate. Used by `LeagueFormModal`, `RulesetFormModal`, `CreatePlayerModal`, `EventFormModal`, `DeckCreateModal`, `DeckEditModal`.
- **`ModalFooterActions`** — just the footer row (`CancelButton` outline + `ConfirmButton`, both click-handler based) for modals that already have their own header/body markup and only need the cancel/confirm pair, not the full `FormModal` shell. Used by `EventCommanderModal`, `TableScoreGrid`, `TableScoreModal`.
- **`ConfirmModal`** — a distinct destructive-confirmation dialog (title/description/question/subject/warning, confirm+cancel with configurable icons) — not a `FormModal`/`ModalFooterActions` variant, it's for "are you sure you want to delete X" flows specifically.

If a new modal needs a title/body/footer shell and is a create-or-edit form → `FormModal`. If it already has bespoke header/body and just needs the button row → `ModalFooterActions`. If it's a delete/destructive confirmation → `ConfirmModal`. Don't hand-roll a fourth footer pattern — extend one of these three first.

## Other pieces here

- **`layout/ListPageShell`** — the list-page chrome (breadcrumb, home/title/add header row, error alert, loading spinner, content slot, `#extra` slot for always-mounted modals). Used by `leagues.vue`/`rulesets.vue`. Only reuse for pages that share that exact `min-h-screen bg-default` list-page shape — `decks/index.vue`/`players/index.vue` have a different shell (`container mx-auto p-6 space-y-6` with an inline header row) and weren't forced into this one.
- **`display/StatTile`** — the icon + big-number + label tile repeated in stat grids (`icon`, `value`, `label`, optional `color`/`background`). Check here before hand-rolling another `flex items-center gap-3 p-3 rounded-lg` stat box.
- **`display/BaseTable`** — generic wrapper around `UTable` with a standard empty state (`emptyTitle`/`emptyDescription`/`emptyIcon`).
- **`input/DatePicker`** — `CalendarDate`-based date input wrapping `@internationalized/date`, not a raw `UInput`/native date picker.
