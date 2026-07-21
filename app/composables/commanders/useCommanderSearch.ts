// app\composables\commanders\useCommanderSearch.ts
import { fetchCommanderByName, type CommanderCard } from './useCommanderCards'
import type { Database } from '#shared/utils/types/database'
import type { CommanderCatalogRow } from './useCommanderCatalogQuery'

async function reorderByPlayerUsage(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  data: CommanderCatalogRow[],
  playerId: number
): Promise<CommanderCatalogRow[]> {
  const { data: usedData, error: usedError } = await supabase
    .from('round_results')
    .select('commander_1, commander_2')
    .eq('player_id', playerId)

  if (usedError || !usedData) return data

  const usedNames = new Set<string>()
  for (const row of usedData) {
    if (row.commander_1) usedNames.add(row.commander_1)
    if (row.commander_2) usedNames.add(row.commander_2)
  }

  return [...data].sort((a, b) => {
    const aUsed = usedNames.has(a.name) ? 1 : 0
    const bUsed = usedNames.has(b.name) ? 1 : 0
    if (aUsed !== bUsed) return bUsed - aUsed
    return (a.edhrecRank ?? 999999) - (b.edhrecRank ?? 999999)
  })
}

function parseManaCost(manaCost: string | null): string[] {
  if (!manaCost) return []
  return manaCost.match(/{[^}]+}/g) ?? []
}

export interface UseCommanderSearchOptions {
  whitelist?: MaybeRefOrGetter<string[] | null | undefined>
  playerId?: MaybeRefOrGetter<number | null | undefined>
}

export function useCommanderSearch(options: UseCommanderSearchOptions = {}) {
  const supabase = useSupabaseClient<Database>()
  const { data: catalog } = useCommanderCatalogQuery()

  const query = ref('')
  const suggestions = ref<string[]>([])
  const suggestionMeta = ref<Record<string, { tokens: string[] }>>({})
  const card = ref<CommanderCard | null>(null)
  const isLoading = ref(false)
  const showSuggestions = ref(false)
  const selectedIndex = ref(-1)

  async function fetchSuggestions(q: string) {
    isLoading.value = true
    try {
      const trimmed = q.trim().toLowerCase()
      const whitelist = toValue(options.whitelist)
      const whitelistSet = whitelist && whitelist.length > 0
        ? new Set(whitelist)
        : null

      let result = (catalog.value ?? []).filter((row) => {
        if (whitelistSet && !whitelistSet.has(row.name)) return false
        if (trimmed.length >= 1 && !row.name.toLowerCase().includes(trimmed)) return false
        return true
      })

      result.sort((a, b) => (a.edhrecRank ?? 999999) - (b.edhrecRank ?? 999999))
      result = result.slice(0, 50)

      // If a playerId is provided, reorder: used commanders first, then by edhrec_rank
      const playerId = toValue(options.playerId)
      if (playerId !== null && playerId !== undefined) {
        result = await reorderByPlayerUsage(supabase, result, playerId)
      }

      suggestions.value = result.map(r => r.name)
      suggestionMeta.value = Object.fromEntries(
        result.map(r => [r.name, { tokens: parseManaCost(r.manaCost) }])
      )
    } finally {
      isLoading.value = false
    }
  }

  async function handleSelect(name: string) {
    const data = await fetchCommanderByName(supabase, name)
    card.value = data
  }

  function navigateSuggestions(direction: 'up' | 'down') {
    if (suggestions.value.length === 0) return
    if (direction === 'down') {
      selectedIndex.value = (selectedIndex.value + 1) % suggestions.value.length
    } else {
      selectedIndex.value = selectedIndex.value <= 0
        ? suggestions.value.length - 1
        : selectedIndex.value - 1
    }
  }

  function selectCurrent() {
    if (selectedIndex.value >= 0 && selectedIndex.value < suggestions.value.length) {
      const name = suggestions.value[selectedIndex.value]
      if (!name) return
      query.value = name
      handleSelect(name)
      showSuggestions.value = false
    }
  }

  function closeSuggestions() {
    showSuggestions.value = false
    selectedIndex.value = -1
  }

  const debouncedFetch = useDebounceFn((q: string) => {
    fetchSuggestions(q)
  }, 150)

  watch(query, (newQuery) => {
    selectedIndex.value = -1
    if (newQuery.length === 0) {
      suggestions.value = []
      suggestionMeta.value = {}
      showSuggestions.value = false
      return
    }
    showSuggestions.value = true
    debouncedFetch(newQuery)
  })

  return {
    query,
    suggestions,
    showSuggestions,
    selectedIndex,
    isLoading,
    handleSelect,
    card,
    suggestionMeta,
    navigateSuggestions,
    selectCurrent,
    closeSuggestions,
  }
}
