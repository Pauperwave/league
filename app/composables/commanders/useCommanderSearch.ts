// app\composables\commanders\useCommanderSearch.ts
import { fetchCommanderByName, type CommanderCard } from './useCommanderCards'
import type { Database } from '#shared/utils/types/database'
import type { CommanderCatalogRow } from './useCommanderCatalogQuery'
import type { FuzzyMatchResult } from '~/utils/fuzzyMatch'

/** Per-commander play history for one player, used to order the "già
 *  giocati" group (ADR-027): most recently played first, ties on the same
 *  calendar day broken by how many times it's been played. */
interface CommanderUsage {
  /** ISO `YYYY-MM-DD` (UTC) of the most recent pairing this commander was
   *  played in — plain string comparison sorts these chronologically. */
  lastPlayedDay: string
  count: number
}

function recordUsage(usage: Map<string, CommanderUsage>, name: string | null, pairingDatetime: string | null) {
  if (!name) return
  const day = pairingDatetime?.slice(0, 10) ?? ''
  const existing = usage.get(name)
  if (!existing) {
    usage.set(name, { lastPlayedDay: day, count: 1 })
    return
  }
  existing.count += 1
  if (day > existing.lastPlayedDay) existing.lastPlayedDay = day
}

async function fetchUsedCommanders(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  playerId: number
): Promise<Map<string, CommanderUsage>> {
  const { data, error } = await supabase
    .from('round_results')
    .select('commander_1, commander_2, pairings(pairing_datetime)')
    .eq('player_id', playerId)

  const usage = new Map<string, CommanderUsage>()
  if (error || !data) return usage

  for (const row of data) {
    const pairing = Array.isArray(row.pairings) ? row.pairings[0] : row.pairings
    recordUsage(usage, row.commander_1, pairing?.pairing_datetime ?? null)
    recordUsage(usage, row.commander_2, pairing?.pairing_datetime ?? null)
  }
  return usage
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
  /** Fuzzy-matched character indices (into `label`) to highlight — see `fuzzyMatch` in `app/utils/fuzzyMatch.ts`. */
  matchIndices?: number[]
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
      const usage = playerId !== null && playerId !== undefined
        ? await fetchUsedCommanders(supabase, playerId)
        : new Map<string, CommanderUsage>()

      // Best fuzzy match first, edhrecRank (popularity) as the tiebreaker —
      // and the only sort when there's no query (score is 0 for everyone).
      const byRelevance = (a: CommanderCatalogRow, b: CommanderCatalogRow) => {
        const scoreDiff = (matches.get(b.name)?.score ?? 0) - (matches.get(a.name)?.score ?? 0)
        return scoreDiff !== 0 ? scoreDiff : (a.edhrecRank ?? 999999) - (b.edhrecRank ?? 999999)
      }
      // ADR-027: "già giocati" ignores relevance/popularity entirely — most
      // recently played day first, ties on the same day broken by play count.
      const byRecency = (a: CommanderCatalogRow, b: CommanderCatalogRow) => {
        const dayDiff = (usage.get(b.name)?.lastPlayedDay ?? '').localeCompare(usage.get(a.name)?.lastPlayedDay ?? '')
        return dayDiff !== 0 ? dayDiff : (usage.get(b.name)?.count ?? 0) - (usage.get(a.name)?.count ?? 0)
      }
      const toItem = (row: CommanderCatalogRow): CommanderSuggestionItem => ({
        label: row.name,
        tokens: parseManaCost(row.manaCost),
        matchIndices: matches.get(row.name)?.indices,
      })

      // Split BEFORE capping to 50 — a niche/unpopular commander the player
      // has actually played must never be cut by the popularity cap before
      // its "already used" status is even checked (a real bug: it used to
      // slice-by-edhrecRank first, so an obscure played commander could
      // never surface here regardless of usage).
      const used = result.filter(row => usage.has(row.name)).sort(byRecency).map(toItem)
      const rest = result.filter(row => !usage.has(row.name)).sort(byRelevance).slice(0, 50).map(toItem)

      const groups: CommanderSuggestionItem[][] = []
      if (used.length > 0) {
        groups.push([{ type: 'label', label: t('commander.search.recentlyUsedGroup') }, ...used])
      }
      if (rest.length > 0) {
        groups.push([{ type: 'label', label: t('commander.search.allCommandersGroup') }, ...rest])
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
  //
  // Also re-fetch once `catalog` itself arrives: on a cold cache the modal
  // can open (and this immediate fetch can run) before useCommanderCatalogQuery
  // resolves, so that first pass filters an empty catalog and "già giocati"
  // never appears — recomputing when catalog changes is what previously
  // required typing a character and deleting it to force a second pass.
  watch([query, () => toValue(options.whitelist), catalog], ([newQuery]) => {
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
