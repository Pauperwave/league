# Checklist gap medi — convenzioni progetto

Checklist operativa derivata da [`skills-audit-report.md`](./skills-audit-report.md) e da `docs/AGENTS.md`.

## Stato implementazione (2026-05-25)

| Batch | Stato |
|-------|-------|
| Path comment (23 file) | ☑ Completato |
| Props inline (`interface Props` → inline) | ☑ Completato (0 file con `interface Props` rimasti) |
| Props con default: `withDefaults` → destructuring (Vue 3.4+) | ☑ Completato (8 file) |
| Store Pinia Setup (4 file) | ☑ Completato |
| Typecheck (`@tanstack/vue-table`, `useCardWhitelists`) | ☑ Completato |
| Verifica | `pnpm lint` ok (7 warning preesistenti), `pnpm typecheck` ok, `pnpm test` ok |

---

**Convenzioni di riferimento:**

- Path comment: prima riga `<!-- app\percorso\relativo.vue -->` (backslash singolo)
- Props: `defineProps<{ ... }>()` inline, senza `interface Props` separata
- Default props (Vue 3.4+): destructuring reattivo su `defineProps`, **non** `withDefaults` (vedi §4 e `docs/AGENTS.md`)
- Pinia: preferire **Setup Store** (`defineStore('id', () => { ... })`) come in `leagues.ts` / `events.ts`

**Legenda colonne:**

| Simbolo | Significato |
|---------|-------------|
| ☐ | Da fare |
| ☑ | Già conforme |
| — | Non applicabile (nessuna prop / già setup store) |

---

## 1. Store Pinia (4 file)

Migrare da Options API a Setup API mantendo API pubblica invariata (`state` → `ref`, `getters` → `computed`, `actions` → funzioni).

| File | Stile attuale | Path comment | Setup store | Note |
|------|---------------|:------------:|:-------------:|------|
| `app/stores/rankings.ts` | Setup | — | ☑ | Migrato 2026-05-25 |
| `app/stores/kills.ts` | Setup | — | ☑ | Migrato 2026-05-25 |
| `app/stores/votes.ts` | Setup | — | ☑ | Migrato 2026-05-25 |
| `app/stores/commanders.ts` | Setup | — | ☑ | Migrato 2026-05-25 |
| `app/stores/leagues.ts` | Setup | — | ☑ | Riferimento per migrazione |
| `app/stores/events.ts` | Setup | — | ☑ | |
| `app/stores/players.ts` | Setup | — | ☑ | |
| `app/stores/rulesets.ts` | Setup | — | ☑ | |

**Ordine suggerito:** `rankings` → `kills` → `votes` → `commanders` (complessità crescente).

**Verifica post-migrazione:**

```bash
pnpm typecheck
pnpm test
pnpm lint
```

Cercare usi dei store in `[eventId].vue` e modali pairings/kill dopo ogni migrazione.

---

## 2. File Vue — path comment + props inline

### Pagine (`app/pages/`)

| File | Path comment | Props inline | Note |
|------|:------------:|:------------:|------|
| `app/app.vue` | ☑ | — | Root layout |
| `app/pages/index.vue` | ☑ | — | |
| `app/pages/login.vue` | ☑ | — | |
| `app/pages/leagues.vue` | ☑ | — | `UpdateLeagueData` per emit è ok (non è Props) |
| `app/pages/rulesets.vue` | ☑ | — | |
| `app/pages/league/[leagueId].vue` | ☑ | — | |
| `app/pages/league/[leagueId]/event/[eventId].vue` | ☑ | — | Pagina orchestratrice; refactor separato |

### Layout

| File | Path comment | Props inline | Note |
|------|:------------:|:------------:|------|
| `app/components/Layout/AppLogo.vue` | ☑ | — | |
| `app/components/Layout/HeaderActions.vue` | ☑ | — | |
| `app/components/Layout/ColorModeSwitch.vue` | ☑ | — | |
| `app/components/Layout/LogoutButton.vue` | ☑ | — | |

### UI

| File | Path comment | Props inline | Note |
|------|:------------:|:------------:|------|
| `app/components/ui/BaseButton.vue` | ☐ | ☐ | `interface Props` |
| `app/components/ui/ActionButtons.vue` | ☐ | ☑ | Props già inline |
| `app/components/ui/CancelButton.vue` | ☑ | ☐ | |
| `app/components/ui/ConfirmModal.vue` | ☑ | ☐ | |
| `app/components/ui/DatePicker.vue` | ☑ | ☐ | |

### Tabelle

| File | Path comment | Props inline | Note |
|------|:------------:|:------------:|------|
| `app/components/Tables/LeagueTable.vue` | ☑ | ☑ | Verificare: no `interface Props` |
| `app/components/Tables/EventTable.vue` | ☑ | ☑ | |

### Rankings

| File | Path comment | Props inline | Note |
|------|:------------:|:------------:|------|
| `app/components/Rankings/LeagueRanking.vue` | ☑ | ☐ | |
| `app/components/Rankings/EventRanking.vue` | ☑ | ☐ | |

### Modali

| File | Path comment | Props inline | Note |
|------|:------------:|:------------:|------|
| `app/components/modals/LeagueFormModal.vue` | ☑ | ☐ | |
| `app/components/modals/EventFormModal.vue` | ☑ | ☐ | |
| `app/components/modals/RulesetFormModal.vue` | ☑ | ☐ | |
| `app/components/modals/CreatePlayerModal.vue` | ☑ | ☐ | |
| `app/components/modals/PlayerSearchModal.vue` | ☑ | ☐ | |
| `app/components/modals/CommanderModal.vue` | ☐ | ☐ | |
| `app/components/modals/DeckPlayVotesModal.vue` | ☐ | ☐ | |
| `app/components/modals/LeaguesUsingRulesetModal.vue` | ☑ | ☐ | |

### Eventi — generali

| File | Path comment | Props inline | Note |
|------|:------------:|:------------:|------|
| `app/components/CommanderSearch.vue` | ☑ | ☐ | |
| `app/components/CardPreview.vue` | ☐ | ☐ | |
| `app/components/events/EventHeaderCard.vue` | ☑ | ☐ | |
| `app/components/events/EventControlPanel.vue` | ☑ | ☑ | |
| `app/components/events/EventStepper.vue` | ☑ | — | Verificare se ha props |
| `app/components/events/StartEventButton.vue` | ☑ | — | |
| `app/components/events/EndedEventBadge.vue` | ☑ | — | |
| `app/components/events/NextRoundModal.vue` | ☑ | — | |
| `app/components/events/RoundTimer.vue` | ☑ | ☐ | |
| `app/components/events/Standings/StandingsCard.vue` | ☑ | ☐ | |

### Eventi — waiting list

| File | Path comment | Props inline | Note |
|------|:------------:|:------------:|------|
| `app/components/events/Waiting/WaitingList.vue` | ☑ | ☑ | |
| `app/components/events/Waiting/WaitingListTable.vue` | ☑ | ☑ | |
| `app/components/events/Waiting/WaitingListStats.vue` | ☑ | ☐ | |

### Eventi — pairings

| File | Path comment | Props inline | Note |
|------|:------------:|:------------:|------|
| `app/components/events/Pairings/PairingsCard.vue` | ☑ | ☐ | |
| `app/components/events/Pairings/TableScoreModal.vue` | ☐ | ☐ | |
| `app/components/events/Pairings/TableScoresModal.vue` | ☐ | ☑ | Aggiungere path; typecheck `@tanstack/vue-table` |
| `app/components/events/Pairings/TableScoreGrid.vue` | ☐ | ☐ | |
| `app/components/events/Pairings/Table/TableCard.vue` | ☐ | ☐ | |
| `app/components/events/Pairings/Table/TableSeatItem.vue` | ☐ | ☐ | |
| `app/components/events/Pairings/Table/TablePreviewToolbar.vue` | ☐ | ☐ | |
| `app/components/events/Pairings/Table/TablePreviewGrid.vue` | ☐ | ☐ | |
| `app/components/events/Pairings/Table/TablePreviewModal.vue` | ☐ | ☐ | SFC grande (~279 righe) |
| `app/components/events/Pairings/Table/TableReceiptSummary.vue` | ☐ | ☐ | |
| `app/components/events/Pairings/Table/TablePlayerReceiptCard.vue` | ☐ | ☐ | |
| `app/components/events/Pairings/Table/TableScoreBreakdownModal.vue` | ☐ | ☐ | |

### Eventi — pairings settings

| File | Path comment | Props inline | Note |
|------|:------------:|:------------:|------|
| `app/components/events/Pairings/Settings/PairingSettingsModal.vue` | ☐ | ☐ | |
| `app/components/events/Pairings/Settings/PairingWeightsSection.vue` | ☐ | ☐ | |
| `app/components/events/Pairings/Settings/ForbiddenPairsSection.vue` | ☐ | ☐ | |
| `app/components/events/Pairings/Settings/PairingPresetButtons.vue` | ☐ | ☐ | |

### Eventi — kill flow

| File | Path comment | Props inline | Note |
|------|:------------:|:------------:|------|
| `app/components/events/Pairings/Kill/KillSystemModal.vue` | ☐ | ☑ | |
| `app/components/events/Pairings/Kill/KillPlayerNode.vue` | ☐ | ☑ | Verificare props inline |
| `app/components/events/Pairings/Kill/KillFlowCanvas.vue` | ☐ | ☑ | ESLint `any` da tipizzare |

---

## 3. Riepilogo numerico

| Area | Totale | Completato |
|------|--------|------------|
| Store Pinia Setup | 8 | 8 |
| Path comment (file `.vue`) | 60 | 60 |
| Props inline (con `defineProps`) | ~46 | ~46 |

*I conteggi props escludono pagine/layout senza `defineProps`. Alcuni file “☑ props” vanno verificati al volo durante il refactor.*

---

## 4. Template modifiche

### Path comment

```vue
<!-- app\components\events\Pairings\TableScoresModal.vue -->
<script setup lang="ts">
```

### Props: prima / dopo

```ts
// Prima (da rimuovere)
interface Props {
  title: string
}
const props = defineProps<Props>()

// Dopo — senza default
const { title } = defineProps<{
  title: string
}>()
```

Con default (Vue 3.4+, pattern preferito):

```vue
<script setup lang="ts">
const {
  totalScore,
  loading = false,
} = defineProps<{
  totalScore: number
  loading?: boolean
}>()
</script>
```

- Default co-locati nella destructuring, senza wrapper
- `withDefaults` è legacy: ancora valido ma da evitare in codice nuovo/refactor
- La reattività delle prop destrutturate è preservata da Vue 3.4+

```ts
// Legacy (da migrare negli 8 file elencati in §7)
const props = withDefaults(defineProps<{
  size?: 'sm' | 'md'
}>(), {
  size: 'md',
})
```

### Pinia Setup (schema)

```ts
export const useRankingsStore = defineStore('rankings', () => {
  const rankingsWithRanks = ref<Map<number, RankingEntry[]>>(new Map())

  const getRankingWithRanks = computed(() => (pairingId: number) =>
    rankingsWithRanks.value.get(pairingId))

  function setRankingWithRanks(pairingId: number, ranking: RankingEntry[]) {
    rankingsWithRanks.value.set(pairingId, ranking)
  }

  return { rankingsWithRanks, getRankingWithRanks, setRankingWithRanks, /* ... */ }
})
```

---

## 5. Ordine di lavoro consigliato

1. **Batch path comment** — 23 file senza commento (modifica meccanica, basso rischio)
2. **Batch props inline** — cartelle `modals/`, `ui/`, poi `Pairings/`
3. **Store Pinia** — uno alla volta con smoke test sulla pagina evento
4. `pnpm lint && pnpm typecheck && pnpm test` a fine ogni batch

---

## 6. File fuori scope di questa checklist

Gap **alti** (non file-per-file qui): vedi report — typecheck, `console.log`, `valibot`, test e2e, `PROGRESS.md`.

---

## 7. Migrazione `withDefaults` → destructuring (Vue 3.4+) — ☑ Completato

Riferimento: [Vue `defineProps` — Reactive Props Destructuring](https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits) (3.4+).

| File | Stato |
|------|-------|
| `app/components/ui/ActionButtons.vue` | ☑ |
| `app/components/ui/BaseButton.vue` | ☑ |
| `app/components/ui/CancelButton.vue` | ☑ |
| `app/components/ui/ConfirmModal.vue` | ☑ |
| `app/components/ui/DatePicker.vue` | ☑ |
| `app/components/Rankings/LeagueRanking.vue` | ☑ |
| `app/components/events/Pairings/Table/TablePreviewToolbar.vue` | ☑ |
| `app/components/events/Pairings/Table/TablePreviewModal.vue` | ☑ |

**Esempio di migrazione** (`TablePreviewToolbar.vue`):

```ts
// Prima
withDefaults(defineProps<{ totalScore: number; loading?: boolean }>(), { loading: false })

// Dopo
const { totalScore, loading = false } = defineProps<{
  totalScore: number
  loading?: boolean
}>()
```

Se servono tutte le prop come oggetto (es. logging che passa `props` intero), si può ancora usare `const props = defineProps<...>()` **senza** default nel tipo e gestire i default a mano, oppure destructuring solo delle prop usate nel template/script.
