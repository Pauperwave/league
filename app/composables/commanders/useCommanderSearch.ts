// app/composables/useCommanderSearch.ts
import { mapToCommanderCard, type CommanderCard } from './useCommanderCards'

type SuggestionRow = { card_name: string; mana_cost: string | null; edhrec_rank: number | null }

async function reorderByPlayerUsage(
  supabase: any,
  data: SuggestionRow[],
  playerId: number
): Promise<SuggestionRow[]> {
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
    const aUsed = usedNames.has(a.card_name) ? 1 : 0
    const bUsed = usedNames.has(b.card_name) ? 1 : 0
    if (aUsed !== bUsed) return bUsed - aUsed
    return (a.edhrec_rank ?? 999999) - (b.edhrec_rank ?? 999999)
  })
}

function parseManaCost(manaCost: string | null): string[] {
  if (!manaCost) return []
  return manaCost.match(/{[^}]+}/g) ?? []
}

export interface UseCommanderSearchOptions {
  whitelist?: string[] | null
  playerId?: number | null
}

export function useCommanderSearch(options: UseCommanderSearchOptions = {}) {
  const supabase = useSupabaseClient()
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
      let dbQuery = supabase
        .from('mtg_commanders')
        .select('card_name, mana_cost, edhrec_rank')

      if (trimmed.length >= 1) {
        dbQuery = dbQuery.ilike('card_name', `%${trimmed}%`)
      }

      if (options.whitelist && options.whitelist.length > 0) {
        dbQuery = dbQuery.in('card_name', options.whitelist)
      }

      const { data, error } = await dbQuery
        .order('edhrec_rank', { ascending: true })
        .limit(50)

      if (error || !data) {
        console.error('[useCommanderSearch] DB error:', error?.message)
        suggestions.value = []
        suggestionMeta.value = {}
        return
      }

      let result: SuggestionRow[] = data

      // If a playerId is provided, reorder: used commanders first, then by edhrec_rank
      if (options.playerId !== null && options.playerId !== undefined) {
        result = await reorderByPlayerUsage(supabase, data, options.playerId)
      }

      suggestions.value = result.map(r => r.card_name)
      suggestionMeta.value = Object.fromEntries(
        result.map(r => [r.card_name, { tokens: parseManaCost(r.mana_cost) }])
      )
    } finally {
      isLoading.value = false
    }
  }

  async function handleSelect(name: string) {
    const { data, error } = await supabase
      .from('mtg_commanders')
      .select('*')
      .eq('card_name', name)
      .single()

    if (error || !data) {
      console.error(`[useCommanderSearch] Card not found: "${name}"`, error?.message)
      card.value = null
      return
    }

    try {
      card.value = mapToCommanderCard(data)
    } catch (err) {
      console.error(`[useCommanderSearch] Validation error for "${name}":`, err)
      card.value = null
    }
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
