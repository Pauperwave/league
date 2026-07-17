// app\stores\events.ts
// fallow-ignore-file code-duplication -- intentional store CRUD boilerplate, see app/stores/CLAUDE.md
import type { Event, EventInsert, StandingWithPlayer, Player, Pairing, PairingWithResults } from '#shared/utils/types'
import type { Database } from '#shared/utils/types/database'
import { sanitizePlayer } from './players'
import type { PairingHistoryEntry } from '~/composables/event-pairing/pairingOptimizer'

type PairingRoundIds = Pick<Pairing, 'pairing_round' | 'pairing_player1_id' | 'pairing_player2_id' | 'pairing_player3_id' | 'pairing_player4_id'>

// ── Pairing generation helpers ──────────────────────────────────────────────

/** Map raw pairing rows to PairingHistoryEntry array */
function mapPairingsToHistory(pairings: PairingRoundIds[]): PairingHistoryEntry[] {
  return (pairings ?? []).map(pairing => ({
    round: pairing.pairing_round ?? 0,
    players: [
      pairing.pairing_player1_id,
      pairing.pairing_player2_id,
      pairing.pairing_player3_id,
      pairing.pairing_player4_id,
    ].filter((id): id is number => id !== null),
  }))
}

// ── Standings helpers ───────────────────────────────────────────────────────

async function fetchStandingsForEvents<T>(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  eventIds: number[],
  selectColumns: string
): Promise<T[]> {
  // selectColumns is a dynamic string, so Supabase can't statically type the
  // response shape — callers pass T to describe the columns they selected.
  const { data, error } = await supabase
    .from('standings')
    .select(selectColumns)
    .in('event_id', eventIds)

  if (error) throw error
  return (data ?? []) as unknown as T[]
}

// ─── Store ──────────────────────────────────────────────────────────────────

/**
 * Store for event management, tournament standings, pairings, and round lifecycle.
 * Uses a loading counter instead of a boolean to handle nested async operations.
 */
export const useEventStore = defineStore('events', () => {
  const supabase = useSupabaseClient()
  const { t } = useI18n()

  // ── State ──────────────────────────────────────────────────────────────────

  /** Events by league */
  const events = ref<Event[]>([])
  /** Currently selected event */
  const currentEvent = ref<Event | null>(null)
  /** Current standings data (with player info) */
  const standings = ref<StandingWithPlayer[]>([])
  /** Current round pairings (with round results) */
  const pairings = ref<PairingWithResults[]>([])
  /** Historical pairings for the pairing optimizer */
  const pairingHistory = ref<PairingHistoryEntry[]>([])
  /** Counter for nested loading — stays true while ANY async action is in flight */
  const loadingCount = ref(0)
  /** Last error message */
  const error = ref<string | null>(null)
  /** Per-league initialization flags to prevent duplicate fetches */
  const initialized = ref<Record<number, boolean>>({})

  // ── Derived loading state ──────────────────────────────────────────────────

  /** True while any async action is in flight */
  const loading = computed(() => loadingCount.value > 0)

  function beginLoading() { loadingCount.value++ }
  function endLoading() { loadingCount.value = Math.max(0, loadingCount.value - 1) }

  // ── Getters ────────────────────────────────────────────────────────────────

  /** Filter events by league ID */
  function getEventsByLeagueId(leagueId: number): Event[] {
    return events.value.filter(e => e.league_id === leagueId)
  }

  /** Check if the current event has finished all rounds */
  const isEventEnded = computed(() => {
    if (!currentEvent.value) return false
    return (currentEvent.value.event_current_round ?? 0) > (currentEvent.value.event_round_number ?? 0)
  })

  // ── Actions: Event CRUD & lifecycle ──────────────────────────────────────────

  /** Load events for a specific league */
  async function fetchEvents(leagueId: number, force = false) {
    if (initialized.value[leagueId] && !force) return

    beginLoading()
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('events')
        .select('*')
        .eq('league_id', leagueId)
        .order('event_datetime', { ascending: false })

      if (supaError) throw supaError

      // Merge: update existing records AND add new ones
      const eventMap = new Map(events.value.map(e => [e.event_id, e]))
      for (const event of data ?? []) {
        eventMap.set(event.event_id, event)
      }
      events.value = Array.from(eventMap.values()).sort(
        (a, b) => new Date(b.event_datetime ?? 0).getTime() - new Date(a.event_datetime ?? 0).getTime()
      )

      // Sync currentEvent if it was updated in the list
      if (currentEvent.value) {
        const updated = (data ?? []).find(e => e.event_id === currentEvent.value?.event_id)
        if (updated) {
          currentEvent.value = updated
        }
      }

      initialized.value[leagueId] = true
    }
    catch (err) {
      error.value = toErrorMessage(err, t('store.event.loadError'))
      console.error('[useEventStore] fetchEvents error:', err)
    }
    finally {
      endLoading()
    }
  }

  /** Create a new event */
  async function createEvent(event: EventInsert) {
    beginLoading()
    error.value = null

    try {
      const { event: created } = await $fetch('/api/events/create', {
        method: 'POST',
        body: event,
      })

      events.value.unshift(created)
      return { success: true as const, data: created }
    }
    catch (err) {
      error.value = toErrorMessage(err, t('store.event.createError'))
      console.error('[useEventStore] createEvent error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }

  /** Update an existing event via the BFF endpoint (ADR-013) */
  async function updateEvent(eventId: number, updates: Partial<Event>): Promise<{ success: boolean; data?: Event; error?: string }> {
    beginLoading()
    error.value = null

    try {
      const { event: updated } = await $fetch<{ event: Event }>(`/api/events/${eventId}/update` as string, {
        method: 'POST',
        body: updates,
      })

      const index = events.value.findIndex(e => e.event_id === eventId)
      if (index !== -1) {
        events.value[index] = updated
      }

      if (currentEvent.value?.event_id === eventId) {
        currentEvent.value = updated
      }

      return { success: true as const, data: updated }
    }
    catch (err) {
      error.value = toErrorMessage(err, t('store.event.updateError'))
      console.error('[useEventStore] updateEvent error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }

  /** Delete an event via the BFF endpoint (ADR-013) */
  async function deleteEvent(eventId: number) {
    beginLoading()
    error.value = null

    try {
      await $fetch<{ deleted: boolean }>(`/api/events/${eventId}/delete` as string, { method: 'POST' })

      events.value = events.value.filter(e => e.event_id !== eventId)
      if (currentEvent.value?.event_id === eventId) currentEvent.value = null

      return { success: true as const }
    }
    catch (err) {
      error.value = toErrorMessage(err, t('store.event.deleteError'))
      console.error('[useEventStore] deleteEvent error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }

  /**
   * Start an event via the BFF endpoint (ADR-013): the server owns the atomic
   * transition (validate waitroom + order → zeroed standings → flip to playing
   * → clear waitroom → round-1 pairings from the confirmed order).
   */
  async function startEvent(eventId: number, playerOrder?: number[]) {
    beginLoading()
    error.value = null

    try {
      const { event: updatedEvent } = await $fetch(`/api/events/${eventId}/start`, {
        method: 'POST',
        body: { playerOrder },
      })

      console.log('[useEventStore] start ok', { eventId })
      currentEvent.value = updatedEvent

      return { success: true as const, data: updatedEvent }
    }
    catch (err) {
      error.value = toErrorMessage(err, t('store.event.startError'))
      console.error('[useEventStore] startEvent error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }

  /**
   * Advance to the next round via the BFF endpoint (ADR-013): the server owns
   * the whole atomic transition (score round → accumulate standings → advance
   * or end the event → insert next pairings from the confirmed playerOrder).
   * The pairing optimizer stays client-side (device-local preferences) — the
   * preview modal's confirmed order travels in the request body.
   */
  async function nextRound(eventId: number, currentRound: number, playerOrder?: number[]) {
    beginLoading()
    error.value = null

    try {
      const { event: updatedEvent, hasEnded } = await $fetch(`/api/events/${eventId}/advance-round`, {
        method: 'POST',
        body: { currentRound, playerOrder },
      })

      console.log('[useEventStore] advance-round ok', { eventId, newRound: updatedEvent.event_current_round, hasEnded })
      currentEvent.value = updatedEvent
      await fetchStandings(eventId)

      return { success: true as const }
    }
    catch (err) {
      error.value = toErrorMessage(err, t('store.event.nextRoundError'))
      console.error('[useEventStore] nextRound error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }

  /**
   * Go back to the previous round (or to registration from round 1) via the
   * BFF endpoint (ADR-013): the server owns the rollback, including the
   * waitroom restore when leaving round 1.
   */
  async function turnBackRound(eventId: number, currentRound: number, leagueId: number) {
    beginLoading()
    error.value = null

    try {
      const { event: updatedEvent } = await $fetch(`/api/events/${eventId}/turn-back-round`, {
        method: 'POST',
        body: { currentRound },
      })

      console.log('[useEventStore] turn-back-round ok', { eventId, newRound: updatedEvent.event_current_round })
      currentEvent.value = updatedEvent

      await fetchEvents(leagueId, true)
      return { success: true as const }
    }
    catch (err) {
      error.value = toErrorMessage(err, t('store.event.turnBackError'))
      console.error('[useEventStore] turnBackRound error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }

  /** Set the currently selected event */
  function setCurrentEvent(event: Event | null) {
    currentEvent.value = event
  }


  /** Load pairings with round results for a specific event and round */
  async function fetchPairings(eventId: number, round: number) {
    try {
      const data = await fetchPairingsWithResults(supabase, eventId, round)
      pairings.value = data
    }
    catch (err) {
      console.error('[useEventStore] fetchPairings error:', err)
    }
  }

  /** Load historical pairings for the pairing optimizer */
  async function fetchPairingHistory(eventId: number) {
    try {
      const { data, error: supaError } = await supabase
        .from('pairings')
        .select('pairing_round, pairing_player1_id, pairing_player2_id, pairing_player3_id, pairing_player4_id')
        .eq('event_id', eventId)
        .order('pairing_round', { ascending: true })

      if (supaError) throw supaError

      pairingHistory.value = mapPairingsToHistory(data)
    }
    catch (err) {
      console.error('[useEventStore] fetchPairingHistory error:', err)
      pairingHistory.value = []
    }
  }

  // ── Actions: Round result submission ─────────────────────────────────────────

  /** Save player rankings (positions) for a pairing via the BFF endpoint (ADR-013) */
  async function savePairingRankings(pairingId: number, rankings: { playerId: number; position: number }[]): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/pairings/${pairingId}/rankings`, { method: 'POST', body: { rankings } })
      console.log('[useEventStore] rankings saved', { pairingId, players: rankings.length })
      return { success: true }
    }
    catch (err) {
      console.error('[useEventStore] savePairingRankings error:', err)
      return { success: false, error: toErrorMessage(err, t('store.event.rankingsSaveError')) }
    }
  }

  /** Save kill counts for a pairing via the BFF endpoint (ADR-013) */
  async function savePairingKills(pairingId: number, killCounts: { playerId: number; count: number }[]): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/pairings/${pairingId}/kills`, { method: 'POST', body: { killCounts } })
      console.log('[useEventStore] kills saved', { pairingId, players: killCounts.length })
      return { success: true }
    }
    catch (err) {
      console.error('[useEventStore] savePairingKills error:', err)
      return { success: false, error: toErrorMessage(err, t('store.event.killsSaveError')) }
    }
  }

  /** Save a player's commanders via the BFF endpoint (ADR-013) */
  async function saveCommander(pairingId: number, playerId: number, commander1: string | null, commander2: string | null = null): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/pairings/${pairingId}/commander`, { method: 'POST', body: { playerId, commander1, commander2 } })
      console.log('[useEventStore] commander saved', { pairingId, playerId })
      return { success: true }
    }
    catch (err) {
      console.error('[useEventStore] saveCommander error:', err)
      return { success: false, error: toErrorMessage(err, t('store.event.commanderSaveError')) }
    }
  }

  /** Save a player's brew and play votes via the BFF endpoint (ADR-013) */
  async function saveVote(pairingId: number, playerId: number, brewVote: number | null, playVote: number | null): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/pairings/${pairingId}/votes`, { method: 'POST', body: { playerId, brewVote, playVote } })
      console.log('[useEventStore] votes saved', { pairingId, playerId })
      return { success: true }
    }
    catch (err) {
      console.error('[useEventStore] saveVote error:', err)
      return { success: false, error: toErrorMessage(err, t('store.event.voteSaveError')) }
    }
  }

  // ── Actions: Standings & results computation ─────────────────────────────────

  /* eslint-disable @typescript-eslint/no-explicit-any */
  /** Load standings for a single event, enriched with total kills and sanitized player info */
  async function fetchStandings(eventId: number) {
    try {
      const { data, error: supaError } = await supabase
        .from('standings')
        .select(`
          *,
          players:player_id (player_id, player_name, player_surname)
        `)
        .eq('event_id', eventId)
        .order('standing_player_score', { ascending: false })

      if (supaError) throw supaError

      const { data: pairingIdsData } = await supabase
        .from('pairings')
        .select('pairing_id')
        .eq('event_id', eventId)

      const pairingIds = (pairingIdsData ?? []).map(p => p.pairing_id)

      const killsMap = new Map<number, number>()
      if (pairingIds.length) {
        const { data: resultsData } = await supabase
          .from('round_results')
          .select('player_id, number_of_kills')
          .not('number_of_kills', 'is', null)
          .in('pairing_id', pairingIds)

        for (const r of resultsData ?? []) {
          const pid = r.player_id
          const count = r.number_of_kills ?? 0
          killsMap.set(pid, (killsMap.get(pid) ?? 0) + count)
        }
      }

      standings.value = (data ?? []).map(s => ({
        ...s,
        kills: killsMap.get(s.player_id) ?? 0,
        players: s.players
          ? sanitizePlayer({
            player_id: s.players.player_id,
            player_name: s.players.player_name,
            player_surname: s.players.player_surname,
          }) as any
          : undefined,
      })) as any
    }
    catch (err) {
      console.error('[useEventStore] fetchStandings error:', err)
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /** Load standings across multiple events */
  async function fetchMultipleEventStandings(eventIds: number[]): Promise<StandingWithPlayer[]> {
    try {
      if (!eventIds.length) return []

      const { data: standingsData, error: standingsError } = await supabase
        .from('standings')
        .select(`
          *,
          players:player_id (player_id, player_name, player_surname)
        `)
        .in('event_id', eventIds)

      if (standingsError) throw standingsError

      return (standingsData ?? []).map(s => ({
        ...s,
        players: s.players
          ? sanitizePlayer({
            player_id: s.players.player_id,
            player_name: s.players.player_name,
            player_surname: s.players.player_surname,
          }) as Player
          : undefined,
      })) as StandingWithPlayer[]
    }
    catch (err) {
      console.error('[useEventStore] fetchMultipleEventStandings error:', err)
      return []
    }
  }

  /** Simple sum aggregation of standings across all league events */
  async function fetchLeagueStandings(leagueId: number) {
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('event_id')
        .eq('league_id', leagueId)

      if (eventsError) throw eventsError
      if (!eventsData?.length) {
        standings.value = []
        return standings.value
      }

      const eventIds = eventsData.map(e => e.event_id)

      interface LeagueStandingRow {
        player_id: number
        standing_player_score: number | null
        victories: number | null
        brew_received: number | null
        play_received: number | null
        players: Pick<Player, 'player_id' | 'player_name' | 'player_surname' | 'formats_played' | 'is_active'> | null
      }

      const standingsData = await fetchStandingsForEvents<LeagueStandingRow>(
        supabase,
        eventIds,
        `
          player_id,
          standing_player_score,
          victories,
          brew_received,
          play_received,
          players:player_id (player_id, player_name, player_surname, formats_played, is_active)
        `
      )

      const playerMap = new Map<number, StandingWithPlayer>()

      for (const s of standingsData ?? []) {
        const existing = playerMap.get(s.player_id)
        if (existing) {
          existing.standing_player_score = (existing.standing_player_score ?? 0) + (s.standing_player_score ?? 0)
          existing.victories = (existing.victories ?? 0) + (s.victories ?? 0)
          existing.brew_received = (existing.brew_received ?? 0) + (s.brew_received ?? 0)
          existing.play_received = (existing.play_received ?? 0) + (s.play_received ?? 0)
        }
        else {
          playerMap.set(s.player_id, {
            standing_id: 0,
            event_id: null,
            player_id: s.player_id,
            standing_player_score: s.standing_player_score ?? 0,
            standing_player_rank: null,
            victories: s.victories ?? 0,
            brew_received: s.brew_received ?? 0,
            play_received: s.play_received ?? 0,
            players: s.players
              ? sanitizePlayer({
                player_id: s.players.player_id,
                player_name: s.players.player_name,
                player_surname: s.players.player_surname,
                formats_played: s.players.formats_played ?? null,
                is_active: s.players.is_active ?? true,
              })
              : undefined,
          })
        }
      }

      standings.value = Array.from(playerMap.values()).sort(
        (a, b) => (b.standing_player_score ?? 0) - (a.standing_player_score ?? 0)
      )

      return standings.value
    } catch (err) {
      console.error('[useEventStore] fetchLeagueStandings error:', err)
      return null
    }
  }

  /**
   * Full ruleset-scored league results with participation bonus and tie-breakers.
   * Applies valid events limit, participation bonus, and multi-level tie-breaking.
   */
  async function fetchLeagueResults(leagueId: number) {
    try {
      const [leagueRes, eventsRes] = await Promise.all([
        supabase.from('leagues').select('ruleset_id').eq('id', leagueId).single(),
        supabase.from('events').select('event_id').eq('league_id', leagueId),
      ])

      if (leagueRes.error || !leagueRes.data?.ruleset_id) throw new Error('No ruleset found')
      if (eventsRes.error) throw eventsRes.error
      if (!eventsRes.data?.length) { standings.value = []; return }

      const { data: ruleset, error: rulesetError } = await supabase
        .from('rulesets')
        .select('*')
        .eq('ruleset_id', leagueRes.data.ruleset_id)
        .single()

      if (rulesetError) throw rulesetError

      const validEventIds = ruleset?.rule_set_valid_events ?? 0
      const participation = ruleset?.rule_set_partecipation ?? 0
      const eventIds = eventsRes.data.map(e => e.event_id)

      interface LeagueResultRow {
        player_id: number
        standing_player_score: number | null
        victories: number | null
        brew_received: number | null
        play_received: number | null
        standing_player_rank: number | null
        players: Pick<Player, 'player_id' | 'player_name' | 'player_surname'> | null
      }

      const standingsData = await fetchStandingsForEvents<LeagueResultRow>(
        supabase,
        eventIds,
        `
          player_id,
          standing_player_score,
          victories,
          brew_received,
          play_received,
          standing_player_rank,
          players:player_id (player_id, player_name, player_surname)
        `
      )

      type PlayerAccumulator = {
        player_id: number
        scores: number[]
        victories: number
        brew_received: number
        play_received: number
        players?: { player_id: number, player_name: string, player_surname: string }
      }

      const playerMap = new Map<number, PlayerAccumulator>()

      for (const s of standingsData ?? []) {
        const existing = playerMap.get(s.player_id)
        if (existing) {
          existing.scores.push(s.standing_player_score ?? 0)
          existing.victories += s.victories ?? 0
          existing.brew_received += s.brew_received ?? 0
          existing.play_received += s.play_received ?? 0
        }
        else {
          playerMap.set(s.player_id, {
            player_id: s.player_id,
            scores: [s.standing_player_score ?? 0],
            victories: s.victories ?? 0,
            brew_received: s.brew_received ?? 0,
            play_received: s.play_received ?? 0,
            players: s.players ?? undefined,
          })
        }
      }

      const results = Array.from(playerMap.values()).map((p) => {
        const sortedScores = [...p.scores].sort((a, b) => b - a)
        const sum = sortedScores.slice(0, validEventIds).reduce((a, b) => a + b, 0)
        const participationBonus = participation * p.scores.length

        return {
          ...p,
          totalScore: sum + participationBonus,
          participations: p.scores.length,
        }
      })

      results.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
        if (b.participations !== a.participations) return b.participations - a.participations
        if (b.victories !== a.victories) return b.victories - a.victories
        if (b.brew_received !== a.brew_received) return b.brew_received - a.brew_received
        return Math.random() - 0.5
      })

      /* eslint-disable @typescript-eslint/no-explicit-any */
      standings.value = results.map((r, index) => ({
        standing_id: 0,
        event_id: null,
        player_id: r.player_id,
        standing_player_score: r.totalScore,
        standing_player_rank: index + 1,
        victories: r.victories,
        brew_received: r.brew_received,
        play_received: r.play_received,
        players: r.players
          ? sanitizePlayer({
            player_id: r.players.player_id,
            player_name: r.players.player_name,
            player_surname: r.players.player_surname,
          }) as any
          : undefined,
      })) as any
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }
    catch (err) {
      console.error('[useEventStore] fetchLeagueResults error:', err)
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    // State
    events,
    currentEvent,
    standings,
    pairings,
    pairingHistory,
    loading,
    error,

    // Getters
    getEventsByLeagueId,
    isEventEnded,

    // Actions — event CRUD & lifecycle
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    startEvent,
    nextRound,
    turnBackRound,
    setCurrentEvent,

    // Actions — pairings
    fetchPairings,
    fetchPairingHistory,

    // Actions — round result submission
    saveVote,
    saveCommander,
    savePairingRankings,
    savePairingKills,

    // Actions — standings & results computation
    fetchStandings,
    fetchMultipleEventStandings,
    fetchLeagueStandings,
    fetchLeagueResults,
  }
})
