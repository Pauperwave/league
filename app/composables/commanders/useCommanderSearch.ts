// app\composables\commanders\useCommanderSearch.ts
import { fetchCommanderByName, type CommanderCard } from './useCommanderCards'
import { useCommanderUsageQuery, type CommanderUsage } from './useCommanderUsageQuery'
import type { Database } from '#shared/utils/types/database'
import type { CommanderCatalogRow } from './useCommanderCatalogQuery'
import type { FuzzyMatchResult } from '~/utils/fuzzyMatch'

function parseManaCost(manaCost: string | null): string[] {
  if (!manaCost) return []
  return manaCost.match(/{[^}]+}/g) ?? []
}

/** A selectable commander name, or a non-interactive group heading (`type: 'label'`) for USelectMenu. */
export interface CommanderSuggestionItem {
  type?: 'label'
  label: string
  tokens?: string[]
  /** Fuzzy-matched character indices (into `label`) to highlight — see `fuzzyMatch` in `app/utils/fuzzyMatch.ts`. */
  matchIndices?: number[]
  /** Scryfall card image, shown in a hover-preview tooltip in CommanderSearch.vue. */
  imageUrl?: string | null
}

export interface UseCommanderSearchOptions {
  whitelist?: MaybeRefOrGetter<string[] | null | undefined>
  playerId?: MaybeRefOrGetter<number | null | undefined>
  /** Every player seated at the same table/round as `playerId` — passed so
   *  the usage lookup below batches into one shared request (see
   *  useCommanderUsageQuery) instead of firing a query per player every
   *  time a commander modal opens. */
  tablePlayerIds?: MaybeRefOrGetter<number[]>
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

  // Batches this player's usage lookup with the rest of the table roster
  // (if given) — see useCommanderUsageQuery's cache-sharing note.
  const usageRosterIds = computed(() => {
    const roster = toValue(options.tablePlayerIds) ?? []
    const playerId = toValue(options.playerId)
    if (playerId !== null && playerId !== undefined && !roster.includes(playerId)) {
      return [...roster, playerId]
    }
    return roster
  })
  const { data: usageByPlayer, isLoading: usageLoading } = useCommanderUsageQuery(usageRosterIds)

  const query = ref('')
  const suggestionGroups = ref<CommanderSuggestionItem[][]>([])
  const card = ref<CommanderCard | null>(null)
  const isComputing = ref(false)
  const isLoading = computed(() => isComputing.value || usageLoading.value)

  function computeSuggestions(q: string) {
    isComputing.value = true
    try {
      const trimmed = q.trim()
      const whitelist = toValue(options.whitelist)
      const whitelistSet = whitelist && whitelist.length > 0
        ? new Set(whitelist)
        : null

      // Fuzzy (subsequence) match instead of a plain substring check — "arl"
      // matches "Karlov", not just contiguous typing. Match indices are kept
      // per name so CommanderSearch.vue can highlight them. A 1-2 char query
      // matches nearly the whole catalog (subsequence matching is lenient),
      // so `result`/the sort below can be catalog-sized in that case — still
      // fine at this catalog size (low thousands) behind the 150ms debounce.
      const matches = new Map<string, FuzzyMatchResult>()
      const result = (catalog.value ?? []).filter((row) => {
        if (whitelistSet && !whitelistSet.has(row.name)) return false
        if (trimmed.length === 0) return true
        const match = fuzzyMatch(row.name, trimmed)
        if (!match) return false
        matches.set(row.name, match)
        return true
      })

      const playerId = toValue(options.playerId)
      const usage: Map<string, CommanderUsage> = (playerId !== null && playerId !== undefined
        ? usageByPlayer.value?.get(playerId)
        : undefined) ?? new Map()

      // Best fuzzy match first, edhrecRank (popularity) as the tiebreaker —
      // and the only sort when there's no query (score is 0 for everyone).
      const byRelevance = (a: CommanderCatalogRow, b: CommanderCatalogRow) => {
        const scoreDiff = (matches.get(b.name)?.score ?? 0) - (matches.get(a.name)?.score ?? 0)
        return scoreDiff !== 0 ? scoreDiff : (a.edhrecRank ?? 999999) - (b.edhrecRank ?? 999999)
      }
      // ADR-027: "già giocati" ignores relevance/popularity entirely — most
      // recently played day first, ties on the same day broken by play count.
      const byRecency = (a: CommanderCatalogRow, b: CommanderCatalogRow) => {
        const dayDiff = (usage.get(b.name)?.lastPlayedDay ?? '')
          .localeCompare(usage.get(a.name)?.lastPlayedDay ?? '')
        return dayDiff !== 0
          ? dayDiff
          : (usage.get(b.name)?.count ?? 0) - (usage.get(a.name)?.count ?? 0)
      }
      const toItem = (row: CommanderCatalogRow): CommanderSuggestionItem => ({
        label: row.name,
        tokens: parseManaCost(row.manaCost),
        matchIndices: matches.get(row.name)?.indices,
        imageUrl: row.imageUrl,
      })

      // Split BEFORE capping to 50 — a niche/unpopular commander the player
      // has actually played must never be cut by the popularity cap before
      // its "already used" status is even checked (a real bug: it used to
      // slice-by-edhrecRank first, so an obscure played commander could
      // never surface here regardless of usage).
      const used = result.filter(row => usage.has(row.name)).sort(byRecency).map(toItem)
      const rest = result
        .filter(row => !usage.has(row.name))
        .sort(byRelevance)
        .slice(0, 50)
        .map(toItem)

      const groups: CommanderSuggestionItem[][] = []
      if (used.length > 0) {
        groups.push([{ type: 'label', label: t('commander.search.recentlyUsedGroup') }, ...used])
      }
      if (rest.length > 0) {
        groups.push([{ type: 'label', label: t('commander.search.allCommandersGroup') }, ...rest])
      }
      suggestionGroups.value = groups
    } finally {
      isComputing.value = false
    }
  }

  async function handleSelect(name: string) {
    const data = await fetchCommanderByName(supabase, name)
    card.value = data
  }

  const debouncedCompute = useDebounceFn((q: string) => {
    computeSuggestions(q)
  }, 150)

  // Recomputes on every dependency that can change the result set: the query
  // text, the whitelist (e.g. commander1's partner type flips, narrowing
  // commander2's options), the catalog itself (on a cold cache the modal can
  // open before useCommanderCatalogQuery resolves, so the first pass would
  // otherwise filter an empty catalog), and the usage lookup (same race for
  // useCommanderUsageQuery — previously only fixable by typing a character
  // and deleting it to force a second pass). Fires immediately so a short
  // whitelist (e.g. "30 carte compatibili") is already browsable before
  // typing anything.
  watch([query, () => toValue(options.whitelist), catalog, usageByPlayer], ([newQuery]) => {
    debouncedCompute(newQuery)
  }, { immediate: true })

  return {
    query,
    suggestionGroups,
    isLoading,
    handleSelect,
    card,
  }
}
