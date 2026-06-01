Ottima base di partenza — la pagina è già parzialmente scomposta. Ecco la mia proposta completa.

## Struttura finale proposta

```
pages/players/index.vue          (~60 righe)
components/
  players/
    PlayersHeader.vue            (~30 righe)
    PlayersToolbar.vue           (~40 righe)
    PlayersGrid.vue              (~30 righe)
    PlayerCard.vue               (~40 righe)
    PlayersEmptyState.vue        (~60 righe)
    PlayerFilterSwitch.vue       ✅ già esiste
    PlayerDeckCount.vue          ✅ già esiste
    PlayerNameTag.vue            ✅ già esiste
  CreatePlayerModal.vue          ✅ già esiste
composables/
  usePlayerStats.ts              (fetch + getter stats)
  usePlayersFilter.ts            (search + filter + sort)
```

### 1. `composables/usePlayerStats.ts`

Isola il fetch Supabase e il getter — riutilizzabile anche in /player/[slug].vue.

```ts
// composables/usePlayerStats.ts
export function usePlayerStats() {
  const supabase = useSupabaseClient()

  const { data: allPlayerStats } = useAsyncData(
    'all-player-stats',
    async () => {
      const { data, error } = await supabase
        .from('player_stats')
        .select('*')
      if (error) throw error
      return data as PlayerStat[]
    },
    { immediate: true }
  )

  function getPlayerStat(
    playerId: number,
    key: 'events_played' | 'total_matches' | 'total_wins' | 'total_kills' | 'average_score'
  ): number {
    return allPlayerStats.value?.find(s => s.player_id === playerId)?.[key] ?? 0
  }

  return { allPlayerStats, getPlayerStat }
}
```

2. `composables/usePlayersFilter.ts`

Tutta la logica di sorting/filtering fuori dalla pagina. Accetta i dati come parametro per non accoppiarlo agli store.

```ts
// composables/usePlayersFilter.ts
import type { Player } from '#shared/utils/types'

export type SortField = 'name' | 'wins' | 'kills' | 'matches' | 'events' | 'avgScore' | 'decks'

export const SORT_OPTIONS = [
  { label: 'Nome', value: 'name' },
  { label: 'Vittorie', value: 'wins' },
  { label: 'Uccisioni', value: 'kills' },
  { label: 'Partite', value: 'matches' },
  { label: 'Eventi', value: 'events' },
  { label: 'Media punti', value: 'avgScore' },
  { label: 'Mazzi', value: 'decks' },
] as const

export function usePlayersFilter(
  players: Ref<Player[]>,
  getPlayerStat: (id: number, key: string) => number,
  getDeckCount: (id: number) => number
) {
  const searchQuery = ref('')
  const showOnlyWithDecks = ref(true)
  const sortBy = ref<SortField>('name')
  const sortDirection = ref<'asc' | 'desc'>('asc')

  const sortedPlayers = computed(() => {
    const list = [...players.value]
    const dir = sortDirection.value === 'asc' ? 1 : -1
    const statKey: Record<string, string> = {
      wins: 'total_wins', kills: 'total_kills',
      matches: 'total_matches', events: 'events_played', avgScore: 'average_score'
    }

    return list.sort((a, b) => {
      if (sortBy.value === 'name') {
        const n = (a.player_name ?? '').localeCompare(b.player_name ?? '') * dir
        return n !== 0 ? n : (a.player_surname ?? '').localeCompare(b.player_surname ?? '') * dir
      }
      if (sortBy.value === 'decks') {
        const diff = getDeckCount(a.player_id) - getDeckCount(b.player_id)
        return diff !== 0 ? diff * dir : (a.player_name ?? '').localeCompare(b.player_name ?? '')
      }
      const key = statKey[sortBy.value] as any
      const diff = getPlayerStat(a.player_id, key) - getPlayerStat(b.player_id, key)
      return diff !== 0 ? diff * dir : (a.player_name ?? '').localeCompare(b.player_name ?? '')
    })
  })

  const filteredPlayers = computed(() => {
    let result = sortedPlayers.value
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      result = result.filter(p =>
        `${p.player_name ?? ''} ${p.player_surname ?? ''}`.toLowerCase().includes(q)
      )
    }
    if (showOnlyWithDecks.value) {
      result = result.filter(p => getDeckCount(p.player_id) > 0)
    }
    return result
  })

  const emptyState = computed((): 'no-search-results' | 'no-decks-filter' | 'no-players' | null => {
    if (filteredPlayers.value.length > 0) return null
    if (searchQuery.value.trim()) return 'no-search-results'
    if (showOnlyWithDecks.value && sortedPlayers.value.length > 0) return 'no-decks-filter'
    return 'no-players'
  })

  function getSortLabel(value: string) {
    return SORT_OPTIONS.find(o => o.value === value)?.label ?? value
  }

  function toggleDirection() {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  }

  return {
    searchQuery, showOnlyWithDecks, sortBy, sortDirection,
    filteredPlayers, emptyState, getSortLabel, toggleDirection
  }
}
```

3. PlayersHeader.vue

```vue
<!-- components/players/PlayersHeader.vue -->
<script setup lang="ts">
defineEmits<{ createPlayer: [] }>()

const breadcrumbItems = [
  { label: 'Home', to: '/' },
  { label: 'Giocatori' }
]
</script>

<template>
  <div class="space-y-4">
    <UBreadcrumb :items="breadcrumbItems" />
    <div class="flex items-center justify-between">
      <UButton color="neutral" icon="i-lucide-arrow-left" to="/">Home</UButton>
      <h1 class="text-2xl font-bold">Giocatori</h1>
      <UButton icon="i-lucide-user-plus" color="primary" @click="$emit('createPlayer')">
        Crea Giocatore
      </UButton>
    </div>
  </div>
</template>
```

4. `PlayersToolbar.vue`

```vue
<!-- components/players/PlayersToolbar.vue -->
<script setup lang="ts">
import { SORT_OPTIONS, type SortField } from '~/composables/usePlayersFilter'

const searchQuery = defineModel<string>('searchQuery', { required: true })
const showOnlyWithDecks = defineModel<boolean>('showOnlyWithDecks', { required: true })
const sortBy = defineModel<SortField>('sortBy', { required: true })
const sortDirection = defineModel<'asc' | 'desc'>('sortDirection', { required: true })
</script>

<template>
  <div class="flex items-center gap-4 flex-wrap">
    <UInput
      v-model="searchQuery"
      type="search"
      icon="i-lucide-search"
      placeholder="Cerca giocatore per nome..."
      class="max-w-sm flex-1"
    />
    <PlayerFilterSwitch v-model="showOnlyWithDecks" />
    <div class="flex items-center gap-2 shrink-0 ml-auto">
      <USelect v-model="sortBy" :items="SORT_OPTIONS" placeholder="Ordina per..." class="w-40" />
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        :icon="sortDirection === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
        :aria-label="sortDirection === 'asc' ? 'Ordina decrescente' : 'Ordina crescente'"
        @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'"
      />
    </div>
  </div>
</template>
```

> Usa `defineModel` (Vue 3.4+) per evitare prop drilling dei valori reattivi.

5. `PlayerCard.vue`

```vue
<!-- components/players/PlayerCard.vue -->
<script setup lang="ts">
import type { Player } from '#shared/utils/types'
import { slugify } from '~/utils/slug'

const props = defineProps<{
  player: Player
  statLabel?: string
  statValue?: string
}>()

const slug = computed(() =>
  slugify(`${props.player.player_name ?? ''} ${props.player.player_surname ?? ''}`.trim())
)
</script>

<template>
  <NuxtLink
    :to="`/player/${slug}`"
    class="flex items-center gap-3 p-4 bg-elevated rounded-lg border border-default hover:border-primary hover:shadow-md transition-all"
  >
    <UAvatar size="md" :text="player.player_name?.charAt(0).toUpperCase() ?? '?'" />
    <div class="flex-1">
      <p class="font-medium">
        {{ player.player_name }}
        <span class="font-bold text-primary">{{ player.player_surname }}</span>
      </p>
      <p v-if="statLabel && statValue !== undefined" class="text-xs text-muted mt-0.5">
        {{ statLabel }}: <span class="font-semibold text-default">{{ statValue }}</span>
      </p>
    </div>
    <PlayerDeckCount :player-id="player.player_id" />
  </NuxtLink>
</template>
```

6. `PlayersGrid.vue`

```vue
<!-- components/players/PlayersGrid.vue -->
<script setup lang="ts">
import type { Player } from '#shared/utils/types'
import type { SortField } from '~/composables/usePlayersFilter'

const props = defineProps<{
  players: Player[]
  sortBy: SortField
  getSortLabel: (v: string) => string
  getPlayerStat: (id: number, key: string) => number
}>()

function resolveStatKey(sort: SortField) {
  const map: Partial<Record<SortField, string>> = {
    wins: 'total_wins', kills: 'total_kills',
    matches: 'total_matches', events: 'events_played', avgScore: 'average_score'
  }
  return map[sort]
}

function getStatValue(playerId: number) {
  const key = resolveStatKey(props.sortBy)
  if (!key) return undefined
  const val = props.getPlayerStat(playerId, key)
  return props.sortBy === 'avgScore' ? val.toFixed(2) : String(val)
}
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    <PlayerCard
      v-for="player in players"
      :key="player.player_id"
      :player="player"
      :stat-label="sortBy !== 'name' && sortBy !== 'decks' ? getSortLabel(sortBy) : undefined"
      :stat-value="getStatValue(player.player_id)"
    />
  </div>
</template>
```

7. `PlayersEmptyState.vue` — componente unico con varianti

Un componente unico è preferibile: stessa struttura visiva, cambia solo il contenuto. Eviti di triplicare markup identico.

```vue
<!-- components/players/PlayersEmptyState.vue -->
<script setup lang="ts">
const props = defineProps<{
  type: 'no-search-results' | 'no-decks-filter' | 'no-players'
  searchQuery?: string
}>()

const emit = defineEmits<{
  createPlayer: []
  clearFilter: []
}>()

const config = computed(() => ({
  'no-search-results': {
    icon: 'i-lucide-search-x',
    title: `Nessun risultato per "${props.searchQuery}"`,
    description: 'Vuoi creare un nuovo giocatore?',
    action: { label: 'Crea Giocatore', icon: 'i-lucide-user-plus', color: 'primary' as const, event: 'createPlayer' as const }
  },
  'no-decks-filter': {
    icon: 'i-lucide-layers',
    title: 'Nessun giocatore ha mazzi associati',
    description: 'Disattiva il filtro per vedere tutti i giocatori',
    action: { label: 'Mostra tutti', icon: undefined, color: 'neutral' as const, event: 'clearFilter' as const }
  },
  'no-players': {
    icon: 'i-lucide-users',
    title: 'Nessun giocatore trovato',
    description: 'Inizia creando il primo giocatore',
    action: { label: 'Crea Giocatore', icon: 'i-lucide-user-plus', color: 'primary' as const, event: 'createPlayer' as const }
  },
})[props.type])
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 space-y-4">
    <UIcon :name="config.icon" class="size-16 text-muted opacity-30" />
    <div class="text-center space-y-1">
      <p class="text-lg font-semibold">{{ config.title }}</p>
      <p class="text-sm text-muted">{{ config.description }}</p>
    </div>
    <UButton
      :icon="config.action.icon"
      :color="config.action.color"
      variant="outline"
      @click="$emit(config.action.event)"
    >
      {{ config.action.label }}
    </UButton>
  </div>
</template>
```

8. `pages/players/index.vue` risultante (~60 righe)

```ts
<script setup lang="ts">
import type { NewPlayer } from '#shared/utils/types'

useSeoMeta({ title: 'Giocatori' })

const playersStore = usePlayerStore()
const decksStore = useCommanderDeckStore()
const toast = useToast()

const { getPlayerStat } = usePlayerStats()

const {
  searchQuery, showOnlyWithDecks, sortBy, sortDirection,
  filteredPlayers, emptyState, getSortLabel, toggleDirection
} = usePlayersFilter(
  computed(() => playersStore.players),
  getPlayerStat,
  (id) => decksStore.getDecksByPlayerId(id).length
)

const showCreatePlayerModal = ref(false)

async function handlePlayerCreate(player: NewPlayer) {
  const result = await playersStore.createPlayer(player)
  if (result?.success && result.data) {
    showCreatePlayerModal.value = false
    toast.add({
      title: 'Giocatore creato',
      description: `${result.data.player_name} ${result.data.player_surname} creato con successo`,
      color: 'success'
    })
  }
}

onMounted(() => {
  if (playersStore.players.length === 0) playersStore.fetchPlayers()
  if (!decksStore.initialized) decksStore.fetchDecks()
})
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <PlayersHeader @create-player="showCreatePlayerModal = true" />

    <PlayersToolbar
      v-model:search-query="searchQuery"
      v-model:show-only-with-decks="showOnlyWithDecks"
      v-model:sort-by="sortBy"
      v-model:sort-direction="sortDirection"
    />

    <div v-if="playersStore.loading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
    </div>

    <PlayersGrid
      v-else-if="filteredPlayers.length > 0"
      :players="filteredPlayers"
      :sort-by="sortBy"
      :get-sort-label="getSortLabel"
      :get-player-stat="getPlayerStat"
    />

    <PlayersEmptyState
      v-else-if="emptyState"
      :type="emptyState"
      :search-query="searchQuery"
      @create-player="showCreatePlayerModal = true"
      @clear-filter="showOnlyWithDecks = false"
    />

    <CreatePlayerModal
      v-model:open="showCreatePlayerModal"
      :player="null"
      :existing-players="playersStore.players"
      @create="handlePlayerCreate"
    />
  </div>
</template>
```

### Riepilogo decisioni chiave

| Scelta | Motivazione |
| :--- | :--- |
| 2 composables | Separano fetch dati (riusabile ovunque) da logica UI (specifica alla lista) |
| `defineModel` in Toolbar | Evita 8 props + 4 emits, il parent rimane sorgente di verità |
| `PlayersEmptyState` unico | Stessa struttura, config-driven — aggiungere un 4° stato è una riga |
| `PlayerCard` con `statLabel`/`statValue` opzionali | Funziona anche senza stat (es. liste compatte in altri contesti) |
| Props function `getPlayerStat` a `PlayersGrid` | Evita di accoppiare la griglia allo store — testabile in isolamento |
