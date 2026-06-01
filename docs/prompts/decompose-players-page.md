# Prompt: Scomposizione Pagina /players in Componenti

## Contesto del Progetto

Progetto Nuxt 3 + Vue 3 + TypeScript + Pinia + Supabase + @nuxt/ui. App per gestire un gioco di carte (Magic: The Gathering Commander).

Architettura:
- **Stato:** Pinia stores (usePlayerStore, useCommanderDeckStore)
- **Dati:** Supabase (tabella `players`, `player_stats`, `commander_decks`)
- **UI:** @nuxt/ui (UButton, UInput, USelect, USwitch, UBadge, UAvatar, UIcon, UModal)
- **Stile:** Tailwind CSS v4
- **Regole:** Composition API `<script setup>`, componenti piccoli e riutilizzabili

## File Attuale

Il file `app/pages/players/index.vue` (308 linee) gestisce:

1. **Header** — titolo, pulsante Home, pulsante "Crea Giocatore"
2. **Search, Filters & Sort** — ricerca testuale, switch filtro mazzi, select ordinamento + toggle direzione
3. **Loading state** — spinner
4. **Player Grid** — griglia di card giocatori con nome, cognome, statistica attiva, badge mazzi
5. **3 Empty States** — nessun risultato ricerca / filtro mazzi attivo / nessun giocatore
6. **Create Player Modal** — modale creazione giocatore

Funzionalità presenti:
- Ricerca per nome
- Filtro "Solo con mazzi" / "Tutti i giocatori" (con conteggio dinamico)
- Ordinamento per 7 campi (nome, vittorie, uccisioni, partite, eventi, media punti, mazzi) con direzione asc/desc
- Mostra statistica attiva sotto il nome del giocatore
- Badge conteggio mazzi (0 = rosso, 1+ = giallo)

## Codice Completo della Pagina

```vue
<!-- app/pages/players/index.vue -->
<script setup lang="ts">
import type { NewPlayer } from '#shared/utils/types'
import { slugify } from '~/utils/slug'

useSeoMeta({ title: 'Giocatori' })

const playersStore = usePlayerStore()
const decksStore = useCommanderDeckStore()
const toast = useToast()
const supabase = useSupabaseClient()

const searchQuery = ref('')
const showOnlyWithDecks = ref(true)
const showCreatePlayerModal = ref(false)

const sortBy = ref<'name' | 'wins' | 'kills' | 'matches' | 'events' | 'avgScore' | 'decks'>('name')
const sortDirection = ref<'asc' | 'desc'>('asc')

const breadcrumbItems = [
  { label: 'Home', to: '/' },
  { label: 'Giocatori' }
]

const sortOptions = [
  { label: 'Nome', value: 'name' },
  { label: 'Vittorie', value: 'wins' },
  { label: 'Uccisioni', value: 'kills' },
  { label: 'Partite', value: 'matches' },
  { label: 'Eventi', value: 'events' },
  { label: 'Media punti', value: 'avgScore' },
  { label: 'Mazzi', value: 'decks' },
]

// Fetch all player stats
const { data: allPlayerStats } = useAsyncData(
  'all-player-stats',
  async () => {
    const { data, error } = await supabase
      .from('player_stats')
      .select('*')
    if (error) throw error
    return data as { player_id: number; events_played: number; total_matches: number; total_wins: number; total_kills: number; average_score: number }[]
  },
  { immediate: true }
)

function getPlayerStat(playerId: number, key: 'events_played' | 'total_matches' | 'total_wins' | 'total_kills' | 'average_score') {
  const stat = allPlayerStats.value?.find(s => s.player_id === playerId)
  return stat?.[key] ?? 0
}

const sortedPlayers = computed(() => {
  const players = [...playersStore.players]
  const dir = sortDirection.value === 'asc' ? 1 : -1

  switch (sortBy.value) {
    case 'wins':
      return players.sort((a, b) => {
        const diff = getPlayerStat(a.player_id, 'total_wins') - getPlayerStat(b.player_id, 'total_wins')
        return diff !== 0 ? diff * dir : (a.player_name ?? '').localeCompare(b.player_name ?? '')
      })
    case 'kills':
      return players.sort((a, b) => {
        const diff = getPlayerStat(a.player_id, 'total_kills') - getPlayerStat(b.player_id, 'total_kills')
        return diff !== 0 ? diff * dir : (a.player_name ?? '').localeCompare(b.player_name ?? '')
      })
    case 'matches':
      return players.sort((a, b) => {
        const diff = getPlayerStat(a.player_id, 'total_matches') - getPlayerStat(b.player_id, 'total_matches')
        return diff !== 0 ? diff * dir : (a.player_name ?? '').localeCompare(b.player_name ?? '')
      })
    case 'events':
      return players.sort((a, b) => {
        const diff = getPlayerStat(a.player_id, 'events_played') - getPlayerStat(b.player_id, 'events_played')
        return diff !== 0 ? diff * dir : (a.player_name ?? '').localeCompare(b.player_name ?? '')
      })
    case 'avgScore':
      return players.sort((a, b) => {
        const diff = getPlayerStat(a.player_id, 'average_score') - getPlayerStat(b.player_id, 'average_score')
        return diff !== 0 ? diff * dir : (a.player_name ?? '').localeCompare(b.player_name ?? '')
      })
    case 'decks':
      return players.sort((a, b) => {
        const diff = decksStore.getDecksByPlayerId(a.player_id).length - decksStore.getDecksByPlayerId(b.player_id).length
        return diff !== 0 ? diff * dir : (a.player_name ?? '').localeCompare(b.player_name ?? '')
      })
    default:
      return players.sort((a, b) => {
        const nameCompare = (a.player_name ?? '').localeCompare(b.player_name ?? '')
        if (nameCompare !== 0) return nameCompare * dir
        return (a.player_surname ?? '').localeCompare(b.player_surname ?? '') * dir
      })
  }
})

const filteredPlayers = computed(() => {
  let result = sortedPlayers.value

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    result = result.filter(p => {
      const fullName = `${p.player_name ?? ''} ${p.player_surname ?? ''}`.toLowerCase()
      return fullName.includes(q)
    })
  }

  if (showOnlyWithDecks.value) {
    result = result.filter(p => decksStore.getDecksByPlayerId(p.player_id).length > 0)
  }

  return result
})

// Distingue i diversi casi di "lista vuota"
const emptyState = computed(() => {
  if (playersStore.loading) return null
  if (filteredPlayers.value.length > 0) return null
  if (searchQuery.value.trim()) return 'no-search-results'
  if (showOnlyWithDecks.value && sortedPlayers.value.length > 0) return 'no-decks-filter'
  return 'no-players'
})

function getSortLabel(value: string) {
  return sortOptions.find(o => o.value === value)?.label ?? value
}

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
  if (playersStore.players.length === 0) {
    playersStore.fetchPlayers()
  }
  if (!decksStore.initialized) {
    decksStore.fetchDecks()
  }
})
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <!-- Breadcrumb -->
    <UBreadcrumb :items="breadcrumbItems" />

    <!-- Header -->
    <div class="flex items-center justify-between">
      <UButton color="neutral" icon="i-lucide-arrow-left" to="/">
        Home
      </UButton>
      <h1 class="text-2xl font-bold">
        Giocatori
      </h1>
      <UButton
        icon="i-lucide-user-plus"
        color="primary"
        @click="showCreatePlayerModal = true"
      >
        Crea Giocatore
      </UButton>
    </div>

    <!-- Search, Filters & Sort -->
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
        <USelect
          v-model="sortBy"
          :items="sortOptions"
          placeholder="Ordina per..."
          class="w-40"
        />
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

    <!-- Loading -->
    <div v-if="playersStore.loading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
    </div>

    <!-- Player Grid -->
    <div
      v-else-if="filteredPlayers.length > 0"
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    >
      <NuxtLink
        v-for="player in filteredPlayers"
        :key="player.player_id"
        :to="`/player/${slugify(`${player.player_name ?? ''} ${player.player_surname ?? ''}`.trim())}`"
        class="flex items-center gap-3 p-4 bg-elevated rounded-lg border border-default hover:border-primary hover:shadow-md transition-all"
      >
        <UAvatar
          size="md"
          :text="player.player_name?.charAt(0).toUpperCase() ?? '?'"
        />
        <div class="flex-1">
          <p class="font-medium">
            {{ player.player_name }}
            <span class="font-bold text-primary">{{ player.player_surname }}</span>
          </p>
          <p v-if="sortBy !== 'name' && sortBy !== 'decks'" class="text-xs text-muted mt-0.5">
            {{ getSortLabel(sortBy) }}:
            <span class="font-semibold text-default">
              <template v-if="sortBy === 'avgScore'">
                {{ getPlayerStat(player.player_id, 'average_score').toFixed(2) }}
              </template>
              <template v-else>
                {{ getPlayerStat(player.player_id, sortBy === 'wins' ? 'total_wins' : sortBy === 'kills' ? 'total_kills' : sortBy === 'matches' ? 'total_matches' : 'events_played') }}
              </template>
            </span>
          </p>
        </div>
        <PlayerDeckCount :player-id="player.player_id" />
      </NuxtLink>
    </div>

    <!-- Empty State: nessun risultato dalla ricerca -->
    <div v-else-if="emptyState === 'no-search-results'" class="flex flex-col items-center justify-center py-16 space-y-4">
      <UIcon name="i-lucide-search-x" class="size-16 text-muted opacity-30" />
      <div class="text-center space-y-1">
        <p class="text-lg font-semibold">
          Nessun risultato per "{{ searchQuery }}"
        </p>
        <p class="text-sm text-muted">
          Vuoi creare un nuovo giocatore?
        </p>
      </div>
      <UButton
        icon="i-lucide-user-plus"
        color="primary"
        @click="showCreatePlayerModal = true"
      >
        Crea Giocatore
      </UButton>
    </div>

    <!-- Empty State: filtro "solo con mazzi" attivo ma nessun risultato -->
    <div v-else-if="emptyState === 'no-decks-filter'" class="flex flex-col items-center justify-center py-16 space-y-4">
      <UIcon name="i-lucide-layers" class="size-16 text-muted opacity-30" />
      <div class="text-center space-y-1">
        <p class="text-lg font-semibold">
          Nessun giocatore ha mazzi associati
        </p>
        <p class="text-sm text-muted">
          Disattiva il filtro per vedere tutti i giocatori
        </p>
      </div>
      <UButton
        variant="outline"
        @click="showOnlyWithDecks = false"
      >
        Mostra tutti
      </UButton>
    </div>

    <!-- Empty State: nessun giocatore nel sistema -->
    <div v-else-if="emptyState === 'no-players'" class="flex flex-col items-center justify-center py-16 space-y-4">
      <UIcon name="i-lucide-users" class="size-14 text-muted opacity-30" />
      <div class="text-center space-y-1">
        <p class="text-lg font-semibold">
          Nessun giocatore trovato
        </p>
        <p class="text-sm text-muted">
          Inizia creando il primo giocatore
        </p>
      </div>
      <UButton
        icon="i-lucide-user-plus"
        color="primary"
        @click="showCreatePlayerModal = true"
      >
        Crea Giocatore
      </UButton>
    </div>

    <!-- Create Player Modal -->
    <CreatePlayerModal
      v-model:open="showCreatePlayerModal"
      :player="null"
      :existing-players="playersStore.players"
      @create="handlePlayerCreate"
    />
  </div>
</template>
```

## Componenti Esistenti nel Progetto

- `PlayerFilterSwitch.vue` — switch filtro mazzi con conteggio dinamico
- `PlayerDeckCount.vue` — badge conteggio mazzi (0 = rosso, 1+ = giallo)
- `PlayerNameTag.vue` — avatar + nome + cognome (usato in altre pagine)
- `CreatePlayerModal.vue` — modale creazione giocatore (riutilizzato da altre pagine)

## La Mia Richiesta

**Come scomponi questa pagina in componenti più piccoli e riutilizzabili?**

Per favore suggerisci:
1. Quali componenti estrarre dalla pagina
2. Quali responsabilità assegnare a ciascun componente
3. Quali props ed eventi usare
4. Se conviene spostare la logica (sorting, filtering, stat fetching) in composables separati
5. Come gestire i 3 empty states (componente unico o separati?)

Tieni presente:
- Preferisco componenti piccoli (< 100 linee)
- La pagina deve rimanere leggibile
- Vuoi evitare "prop drilling" eccessivo
- Il pattern della griglia con card potrebbe essere riutilizzato in altre pagine (es. /decks)
