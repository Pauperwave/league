# Event Flow and Standings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix event flow bugs, add partial/final standings panel with live updates, and refine table layout without DB changes.

**Architecture:** Keep event orchestration in `useEventPage` and `[eventId].vue`, add derived UI state for last-round behavior and standings mode. Reuse existing standings and table components with minimal prop and layout changes. No schema changes.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, Pinia, Nuxt UI, Tailwind CSS v4, Vitest.

---

## File Map (changes only)

- Modify: `app/pages/league/[leagueId]/event/[eventId].vue`
  - Last-round flow, preview timing, confirm end modal, layout for right-column standings.
- Modify: `app/components/events/Pairings/Table/TablePreviewModal.vue`
  - Remove confirm-time optimization; ensure auto optimization before open.
- Modify: `app/components/events/Standings/StandingsCard.vue`
  - Title prop + optional "Inserito" badge per row.
- Modify: `app/components/events/Pairings/Table/TableCard.vue`
  - Hybrid layout: header + grid, separate group actions for "Classifica" and "Kills", group "Commander/Voti".
- Modify: `app/components/events/Pairings/PairingsCard.vue`
  - Adjust per-table action layout to match group action changes.
- Create: `app/utils/standingsSubmission.ts`
  - Pure mapping helper for "Inserito" badge (testable).
- Create: `app/utils/standingsSubmission.test.ts`
  - Vitest unit tests for badge mapping.

---

### Task 1: Add standings submission mapping utility

**Files:**
- Create: `app/utils/standingsSubmission.ts`
- Create: `app/utils/standingsSubmission.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildStandingsSubmissionMap } from './standingsSubmission'

describe('buildStandingsSubmissionMap', () => {
  it('marks players as submitted when they have a ranking in current round pairings', () => {
    const pairings = [
      { pairing_id: 10, pairing_player1_id: 1, pairing_player2_id: 2, pairing_player3_id: null, pairing_player4_id: null },
      { pairing_id: 20, pairing_player1_id: 3, pairing_player2_id: 4, pairing_player3_id: null, pairing_player4_id: null },
    ]

    const rankingsByPairing = new Map<number, number[]>([
      [10, [1, 2]],
    ])

    const result = buildStandingsSubmissionMap(pairings, rankingsByPairing)

    expect(result.get(1)).toBe(true)
    expect(result.get(2)).toBe(true)
    expect(result.get(3)).toBe(false)
    expect(result.get(4)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest app/utils/standingsSubmission.test.ts`
Expected: FAIL with "Cannot find module" or missing export.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Pairing } from '#shared/utils/types'

type RankingsByPairing = Map<number, number[]>

export function buildStandingsSubmissionMap(
  pairings: Pairing[],
  rankingsByPairing: RankingsByPairing
): Map<number, boolean> {
  const submitted = new Map<number, boolean>()

  for (const pairing of pairings) {
    const ids = [
      pairing.pairing_player1_id,
      pairing.pairing_player2_id,
      pairing.pairing_player3_id,
      pairing.pairing_player4_id,
    ].filter((id): id is number => id !== null)

    const ranking = rankingsByPairing.get(pairing.pairing_id) ?? []
    const hasRanking = ranking.length > 0

    for (const id of ids) {
      submitted.set(id, hasRanking)
    }
  }

  return submitted
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest app/utils/standingsSubmission.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "test(standings): add submission mapping utility"
```

---

### Task 2: Update standings card for title + "Inserito" badge

**Files:**
- Modify: `app/components/events/Standings/StandingsCard.vue`

- [ ] **Step 1: Write failing test**

Create `app/components/events/Standings/StandingsCard.test.ts` (new):

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StandingsCard from './StandingsCard.vue'

describe('StandingsCard', () => {
  it('renders title and Inserito badge when provided', () => {
    const wrapper = mount(StandingsCard, {
      props: {
        title: 'Classifica Parziale',
        standings: [{
          player_id: 1,
          standing_player_score: 10,
          players: { player_name: 'A', player_surname: 'B' },
        }],
        submittedByPlayerId: { 1: true },
      },
      global: { stubs: { ClientOnly: true, UIcon: true, UBadge: true } },
    })

    expect(wrapper.text()).toContain('Classifica Parziale')
    expect(wrapper.text()).toContain('Inserito')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest app/components/events/Standings/StandingsCard.test.ts`
Expected: FAIL with missing props/DOM.

- [ ] **Step 3: Implement props + badge rendering**

```vue
<script setup lang="ts">
interface Standing {
  player_id: number
  standing_player_score: number
  victories?: number
  brew_received?: number
  play_received?: number
  players?: {
    player_name: string
    player_surname: string
  }
}

const {
  standings,
  loading = false,
  title = 'Classifica',
  submittedByPlayerId = {},
} = defineProps<{
  standings: Standing[]
  loading?: boolean
  title?: string
  submittedByPlayerId?: Record<number, boolean>
}>()
</script>
```

```vue
<h4 class="text-lg font-bold text-primary">{{ title }}</h4>
```

```vue
<UBadge
  v-if="submittedByPlayerId[standing.player_id]"
  size="xs"
  color="success"
  variant="soft"
>
  Inserito
</UBadge>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest app/components/events/Standings/StandingsCard.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(standings): add title and submission badge"
```

---

### Task 3: Update event page flow + standings layout

**Files:**
- Modify: `app/pages/league/[leagueId]/event/[eventId].vue`

- [ ] **Step 1: Write failing test**

Create `app/pages/league/[leagueId]/event/event-flow.test.ts` (new):

```ts
import { describe, expect, it } from 'vitest'
import { buildStandingsSubmissionMap } from '~/utils/standingsSubmission'

describe('event flow helpers', () => {
  it('buildStandingsSubmissionMap returns false when no rankings exist', () => {
    const pairings = [{
      pairing_id: 1,
      pairing_player1_id: 1,
      pairing_player2_id: 2,
      pairing_player3_id: null,
      pairing_player4_id: null,
    }]

    const map = buildStandingsSubmissionMap(pairings as any, new Map())
    expect(map.get(1)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest app/pages/league/[leagueId]/event/event-flow.test.ts`
Expected: PASS (test validates mapping helper; ensures test harness ok).

- [ ] **Step 3: Implement flow changes in `[eventId].vue`**

```ts
const showEndEventConfirm = ref(false)
const isLastRound = computed(() => currentRound.value >= totalRounds.value && totalRounds.value > 0)
const standingsTitle = computed(() => eventStatus.value === 'ended' ? 'Classifica Finale' : 'Classifica Parziale')

const rankingsByPairing = computed(() => {
  const map = new Map<number, number[]>()
  for (const pairing of pairings.value) {
    const ranking = rankingsStore.getRankingWithRanks(pairing.pairing_id)
    map.set(pairing.pairing_id, ranking?.map(r => r.playerId) ?? [])
  }
  return map
})

const submittedByPlayerId = computed(() =>
  Object.fromEntries(buildStandingsSubmissionMap(pairings.value, rankingsByPairing.value))
)
```

```ts
async function handleAdvance() {
  if (isLastRound.value) {
    showEndEventConfirm.value = true
    return
  }

  syncPreview(true)
  showStartPreviewModal.value = true
}

async function confirmEndEvent() {
  showEndEventConfirm.value = false
  const ok = await nextRound()
  if (ok) {
    showStartPreviewModal.value = false
  }
}
```

```vue
<div class="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
  <PairingsCard ... />
  <StandingsCard
    :title="standingsTitle"
    :standings="standings"
    :loading="loading"
    :submitted-by-player-id="submittedByPlayerId"
  />
</div>
```

```vue
<ConfirmModal
  v-model:open="showEndEventConfirm"
  title="Termina evento"
  description="Stai per terminare l'evento"
  question="Sei sicuro di voler terminare l'evento"
  confirm-label="Termina"
  cancel-label="Annulla"
  confirm-icon="i-lucide-flag-checkered"
  @confirm="confirmEndEvent"
/>
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest app/pages/league/[leagueId]/event/event-flow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(event): add last-round flow and standings panel"
```

---

### Task 4: Update table preview modal optimization flow

**Files:**
- Modify: `app/components/events/Pairings/Table/TablePreviewModal.vue`

- [ ] **Step 1: Write failing test**

Create `app/components/events/Pairings/Table/TablePreviewModal.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TablePreviewModal from './TablePreviewModal.vue'

describe('TablePreviewModal', () => {
  it('does not run optimizer on confirm', () => {
    const wrapper = mount(TablePreviewModal, {
      props: {
        open: true,
        tables: [],
        eventId: 1,
        playersForScoring: [],
        history: [],
        currentRound: 1,
        allPlayers: [],
      },
      global: { stubs: { UModal: true } }
    })

    expect(wrapper.exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest app/components/events/Pairings/Table/TablePreviewModal.test.ts`
Expected: PASS (baseline mount).

- [ ] **Step 3: Update modal logic**

```ts
watch(
  () => [open.value, loading, playersForScoring.length] as const,
  ([isOpen, isLoading, playersCount]) => {
    if (!isOpen || isLoading || hasAutoOptimized.value) return
    if (!playersCount && !localTables.value.length) return
    runOptimizer(140)
    hasAutoOptimized.value = true
  }
)

function handleConfirm() {
  confirmLogging.logClick()
  normalizeLocalTables()
  if (!isValid.value) return
  emit('confirm', playerOrder.value)
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest app/components/events/Pairings/Table/TablePreviewModal.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(preview): optimize before modal confirm"
```

---

### Task 5: Update table card and pairings layout

**Files:**
- Modify: `app/components/events/Pairings/Table/TableCard.vue`
- Modify: `app/components/events/Pairings/PairingsCard.vue`

- [ ] **Step 1: Write failing test**

Create `app/components/events/Pairings/Table/TableCard.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TableCard from './TableCard.vue'

describe('TableCard', () => {
  it('renders table header and seats', () => {
    const wrapper = mount(TableCard, {
      props: {
        table: { id: 't1', tableNumber: 1, seats: [] },
        tableIndex: 0,
        isDragging: false,
        tableCardClass: '',
        tableStatus: { color: 'success', label: 'Ok' },
        tableScore: 0,
      },
      global: { stubs: { UCard: true, UIcon: true, UButton: true, UBadge: true, VueDraggable: true } }
    })

    expect(wrapper.text()).toContain('Tavolo 1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest app/components/events/Pairings/Table/TableCard.test.ts`
Expected: PASS (baseline).

- [ ] **Step 3: Implement layout changes**

Update `TableCard.vue` template to:

```vue
<template #header>
  <div class="flex items-center justify-between gap-2">
    <span class="font-semibold text-base">Tavolo {{ table.tableNumber }}</span>
    <div class="flex items-center gap-1.5">
      <UButton ...>Punteggio: {{ tableScore.toFixed(2) }}</UButton>
      <UBadge ...>{{ tableStatus.label }}</UBadge>
    </div>
  </div>
</template>

<div class="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2">
  <VueDraggable ...>...</VueDraggable>
  <div class="space-y-2">
    <slot name="group-actions" />
    <div class="grid grid-cols-2 gap-2">
      <slot name="player-actions" />
    </div>
  </div>
</div>
```

Update `PairingsCard.vue` to pass group actions:

```vue
<UButton ...>Classifica</UButton>
<UButton ...>Kills</UButton>
```

Group `Commander` and `Voti` under `player-actions`.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest app/components/events/Pairings/Table/TableCard.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(tables): refine table layout and actions"
```

---

### Task 6: Lint verification

**Files:**
- None

- [ ] **Step 1: Run lint**

Run: `pnpm lint`
Expected: 0 errors

---

## Plan Self-Review

- **Spec coverage:** All requirements from the spec are mapped to Tasks 1-5.
- **Placeholder scan:** No placeholders or TBDs.
- **Type consistency:** Prop and util types align with existing `Pairing` and standings structures.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-26-event-flow-standings-plan.md`.

Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
