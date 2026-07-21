// app\composables\commanders\useCommanderSearch.ts
import { fetchCommanderByName, type CommanderCard } from './useCommanderCards'
import type { Database } from '#shared/utils/types/database'
import type { CommanderCatalogRow } from './useCommanderCatalogQuery'

async function fetchUsedCommanderNames(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  playerId: number
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('round_results')
    .select('commander_1, commander_2')
    .eq('player_id', playerId)

  if (error || !data) return new Set()

  const usedNames = new Set<string>()
  for (const row of data) {
    if (row.commander_1) usedNames.add(row.commander_1)
    if (row.commander_2) usedNames.add(row.commander_2)
  }
  return usedNames
}

function parseManaCost(manaCost: string | null): string[] {
  if (!manaCost) return []
  return manaCost.match(/{[^}]+}/g) ?? []
}

/** A selectable commander name, or a non-interactive group heading (`type: 'label'`) for USelectMenu. */
export interface CommanderSuggestionItem {
  type?: 'label'
  label: string
  tokens?: string[]
}

export interface UseCommanderSearchOptions {
  whitelist?: MaybeRefOrGetter<string[] | null | undefined>
  playerId?: MaybeRefOrGetter<number | null | undefined>
}

/**
 * Commander autocomplete: filters the already-cached catalog (ADR-016)
 * client-side, no query goes out per keystroke. When `playerId` is given,
 * results are split into a "recently used" group (commanders this player has
 * already played, per `round_results`) shown first, and the rest — instead of
 * just sorting the used ones to the top of one flat list, so USelectMenu can
 * render them as a visually separate group.
 */
export function useCommanderSearch(options: UseCommanderSearchOptions = {}) {
  const supabase = useSupabaseClient<Database>()
  const { data: catalog } = useCommanderCatalogQuery()
  const { t } = useI18n()

  const query = ref('')
  const suggestionGroups = ref<CommanderSuggestionItem[][]>([])
  const card = ref<CommanderCard | null>(null)
  const isLoading = ref(false)

  async function fetchSuggestions(q: string) {
    isLoading.value = true
    try {
      const trimmed = q.trim().toLowerCase()
      const whitelist = toValue(options.whitelist)
      const whitelistSet = whitelist && whitelist.length > 0
        ? new Set(whitelist)
        : null

      const result = (catalog.value ?? []).filter((row) => {
        if (whitelistSet && !whitelistSet.has(row.name)) return false
        if (trimmed.length >= 1 && !row.name.toLowerCase().includes(trimmed)) return false
        return true
      })

      const playerId = toValue(options.playerId)
      const usedNames = playerId !== null && playerId !== undefined
        ? await fetchUsedCommanderNames(supabase, playerId)
        : new Set<string>()

      const byRank = (a: CommanderCatalogRow, b: CommanderCatalogRow) => (a.edhrecRank ?? 999999) - (b.edhrecRank ?? 999999)
      const toItem = (row: CommanderCatalogRow): CommanderSuggestionItem => ({
        label: row.name,
        tokens: parseManaCost(row.manaCost),
      })

      // Split BEFORE capping to 50 — a niche/unpopular commander the player
      // has actually played must never be cut by the popularity cap before
      // its "already used" status is even checked (a real bug: it used to
      // slice-by-edhrecRank first, so an obscure played commander could
      // never surface here regardless of usage).
      const used = result.filter(row => usedNames.has(row.name)).sort(byRank).map(toItem)
      const rest = result.filter(row => !usedNames.has(row.name)).sort(byRank).slice(0, 50).map(toItem)

      const groups: CommanderSuggestionItem[][] = []
      if (used.length > 0) {
        groups.push([{ type: 'label', label: t('commander.search.recentlyUsedGroup') }, ...used])
      }
      if (rest.length > 0) {
        groups.push(rest)
      }
      suggestionGroups.value = groups
    } finally {
      isLoading.value = false
    }
  }

  async function handleSelect(name: string) {
    const data = await fetchCommanderByName(supabase, name)
    card.value = data
  }

  const debouncedFetch = useDebounceFn((q: string) => {
    fetchSuggestions(q)
  }, 150)

  // Also re-fetch when the whitelist changes (e.g. commander1's partner type
  // flips, narrowing commander2's options) even if the query text itself
  // didn't change — and fires immediately so a short whitelist (e.g. "30
  // carte compatibili") is already browsable before typing anything.
  watch([query, () => toValue(options.whitelist)], ([newQuery]) => {
    debouncedFetch(newQuery)
  }, { immediate: true })

  return {
    query,
    suggestionGroups,
    isLoading,
    handleSelect,
    card,
  }
}
