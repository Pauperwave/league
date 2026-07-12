// app\stores\events.ts
import { useI18n } from 'vue-i18n'
import type { Event, EventInsert, StandingWithPlayer, Player, Pairing, PairingWithResults, RoundResult, RoundResultInsert, Ruleset, Standing } from '#shared/utils/types'
import type { Database } from '#shared/utils/types/database'
import { toErrorMessage } from '~/utils/error'
import { sanitizePlayer } from './players'
import type {
  PairingPlayer,
  PairingHistoryEntry,
} from '~/composables/event-pairing/pairingOptimizer'
import { getPairingPreferences } from '~/composables/event-pairing/pairingPreferences'

const UNRANKED_FALLBACK = 9999

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

/** Shape for inserting a new pairing row into Supabase */
interface PairingInsert {
  event_id: number
  pairing_round: number
  pairing_is_full: boolean
  pairing_player1_id: number | null
  pairing_player2_id: number | null
  pairing_player3_id: number | null
  pairing_player4_id: number | null
}

/** Build PairingInsert rows from a list of tables (each table is an array of player IDs) */
function buildPairingRows(eventId: number, round: number, tables: number[][]): PairingInsert[] {
  return tables
    .filter(table => table.length >= 3)
    .map(table => ({
      event_id: eventId,
      pairing_round: round,
      pairing_is_full: table.length === 4,
      pairing_player1_id: table[0] ?? null,
      pairing_player2_id: table[1] ?? null,
      pairing_player3_id: table[2] ?? null,
      pairing_player4_id: table[3] ?? null,
    }))
}

// ── Standings / round-scoring helpers (used by nextRound) ──────────────────

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

interface StandingAccumulator {
  player_id: number
  standing_player_score: number
  victories: number
  brew_received: number
  play_received: number
}

/** Resolve event → league → ruleset and build position-value array */
async function resolveEventRuleset(supabase: ReturnType<typeof useSupabaseClient<Database>>, eventId: number) {
  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .select('league_id, event_round_number')
    .eq('event_id', eventId)
    .single()

  if (eventError || !eventData?.league_id) throw eventError ?? new Error('No league_id')

  const { data: leagueData, error: leagueError } = await supabase
    .from('leagues')
    .select('ruleset_id')
    .eq('id', eventData.league_id)
    .single()

  if (leagueError || !leagueData?.ruleset_id) throw leagueError ?? new Error('No ruleset_id')

  const { data: ruleset, error: rulesetError } = await supabase
    .from('rulesets')
    .select('*')
    .eq('ruleset_id', leagueData.ruleset_id)
    .single()

  if (rulesetError) throw rulesetError

  const posValues = [
    0,
    ruleset?.rule_set_rank1 ?? 0,
    ruleset?.rule_set_rank2 ?? 0,
    ruleset?.rule_set_rank3 ?? 0,
    ruleset?.rule_set_rank4 ?? 0,
  ]

  return { ruleset, posValues, eventRoundNumber: eventData.event_round_number }
}

/** Fetch pairings, round results, and current standings for a round */
async function fetchRoundData(supabase: ReturnType<typeof useSupabaseClient<Database>>, eventId: number, currentRound: number) {
  const [{ data: pairingsData, error: pairingsError }, { data: currentStandings, error: currentStandingsError }] = await Promise.all([
    supabase.from('pairings').select('*').eq('event_id', eventId).eq('pairing_round', currentRound),
    supabase.from('standings').select('player_id, standing_player_score, victories, brew_received, play_received').eq('event_id', eventId),
  ])

  if (pairingsError) throw pairingsError
  if (currentStandingsError) throw currentStandingsError

  const pairingIds = (pairingsData ?? []).map(p => p.pairing_id)

  const { data: allResults, error: allResultsError } = await supabase
    .from('round_results')
    .select('*')
    .in('pairing_id', pairingIds)

  if (allResultsError) throw allResultsError

  const standingsMap = new Map<number, StandingAccumulator>(
    (currentStandings ?? []).map(s => [s.player_id, {
      player_id: s.player_id,
      standing_player_score: s.standing_player_score ?? 0,
      victories: s.victories ?? 0,
      brew_received: s.brew_received ?? 0,
      play_received: s.play_received ?? 0,
    }])
  )

  return { pairings: pairingsData ?? [], results: allResults ?? [], standingsMap }
}

/** Calculate scores from round results and update accumulator */
function calculateRoundScores(
  pairings: Pairing[],
  results: RoundResult[],
  standingsMap: Map<number, StandingAccumulator>,
  posValues: number[],
  ruleset: Ruleset | null,
) {
  for (const pairing of pairings) {
    const playerIds = ([
      pairing.pairing_player1_id,
      pairing.pairing_player2_id,
      pairing.pairing_player3_id,
      pairing.pairing_player4_id,
    ] as Array<number | null>).filter((pid): pid is number => pid !== null)

    const tableResults = results.filter(r => r.pairing_id === pairing.pairing_id)

    for (const playerId of playerIds) {
      const myResult = tableResults.find(r => r.player_id === playerId)
      if (!myResult) continue

      const position = myResult.position ?? 0
      const numberOfKills = myResult.number_of_kills ?? 0

      const otherResults = tableResults.filter(r => r.player_id !== playerId)
      const brewVote = otherResults.filter(r => r.brew_vote === playerId).length
      const totalPlayCount = otherResults.filter(
        r => r.play_vote_1 === playerId || r.play_vote_2 === playerId,
      ).length

      const samePositionCount = position !== 0
        ? tableResults.filter(r => r.position === position).length
        : 1

      let rankSum = 0
      for (let i = 0; i < samePositionCount; i++) {
        rankSum += posValues[Math.min(position + i, 4)] ?? 0
      }
      const scoreRank = Math.floor(rankSum / samePositionCount)

      const totalScore = scoreRank
        + numberOfKills * (ruleset?.rule_set_kill ?? 0)
        + brewVote * (ruleset?.rule_set_brew ?? 0)
        + totalPlayCount * (ruleset?.rule_set_play ?? 0)

      const acc = standingsMap.get(playerId)
      if (acc) {
        acc.standing_player_score += totalScore
        acc.victories += position === 1 ? 1 : 0
        acc.brew_received += brewVote
        acc.play_received += totalPlayCount
      }
    }
  }
}

/** Batch-update standings scores, then update ranks */
async function updateStandingsAndRanks(supabase: ReturnType<typeof useSupabaseClient<Database>>, eventId: number, standingsMap: Map<number, StandingAccumulator>) {
  await Promise.all(
    Array.from(standingsMap.values()).map(s =>
      supabase
        .from('standings')
        .update({
          standing_player_score: s.standing_player_score,
          victories: s.victories,
          brew_received: s.brew_received,
          play_received: s.play_received,
        })
        .eq('event_id', eventId)
        .eq('player_id', s.player_id),
    ),
  )

  const ranked = Array.from(standingsMap.values()).sort(
    (a, b) => b.standing_player_score - a.standing_player_score,
  )

  await Promise.all(
    ranked.map((s, index) =>
      supabase
        .from('standings')
        .update({ standing_player_rank: index + 1 })
        .eq('event_id', eventId)
        .eq('player_id', s.player_id),
    ),
  )
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
      const { data, error: supaError } = await supabase
        .from('events')
        .insert([event])
        .select()
        .single()

      if (supaError) throw supaError
      if (!data) return { success: false as const, error: 'No data returned' }

      events.value.unshift(data)
      return { success: true as const, data }
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

  /** Update an existing event */
  async function updateEvent(eventId: number, updates: Partial<Event>): Promise<{ success: boolean; data?: Event; error?: string }> {
    beginLoading()
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('events')
        .update(updates)
        .eq('event_id', eventId)
        .select()
        .single()

      if (supaError) throw supaError
      if (!data) return { success: false as const, error: 'No data returned' }

      const index = events.value.findIndex(e => e.event_id === eventId)
      if (index !== -1) {
        events.value[index] = data
      }

      if (currentEvent.value?.event_id === eventId) {
        currentEvent.value = data
      }

      return { success: true as const, data }
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

  /** Delete an event by ID */
  async function deleteEvent(eventId: number) {
    beginLoading()
    error.value = null

    try {
      const { error: supaError } = await supabase
        .from('events')
        .delete()
        .eq('event_id', eventId)

      if (supaError) throw supaError

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
   * Start an event: create standings, clear waitroom, create first round pairings.
   * Validates player count (min 3, not 5) and optionally accepts a custom player order.
   */
  async function startEvent(eventId: number, playerOrder?: number[]) {
    beginLoading()
    error.value = null

    try {
      const { data: waitingPlayers, error: waitingError } = await supabase
        .from('waitroom')
        .select('player_id')
        .eq('event_id', eventId)
        .order('inserted_at', { ascending: true })

      if (waitingError) throw waitingError

      const count = waitingPlayers?.length ?? 0
      if (count < 3 || count === 5) {
        throw new Error(t('store.event.invalidPlayerCount'))
      }

      const waitroomIds = (waitingPlayers ?? []).map(player => player.player_id)
      const selectedOrder = playerOrder?.length ? playerOrder : waitroomIds

      const hasSameLength = selectedOrder.length === waitroomIds.length
      const hasValidIds = selectedOrder.every(id => waitroomIds.includes(id))
      const hasUniqueIds = new Set(selectedOrder).size === selectedOrder.length

      if (!hasSameLength || !hasValidIds || !hasUniqueIds) {
        throw new Error(t('store.event.invalidPlayerOrder'))
      }

      const standingsData = selectedOrder.map((playerId, index) => ({
        event_id: eventId,
        player_id: playerId,
        standing_player_score: 0,
        standing_player_rank: index + 1,
        victories: 0,
        brew_received: 0,
        play_received: 0,
      }))

      const { error: standingsError } = await supabase
        .from('standings')
        .insert(standingsData)

      if (standingsError) throw standingsError

      const { data, error: updateError } = await supabase
        .from('events')
        .update({
          event_playing: true,
          event_current_round: 1,
          event_registration_open: false,
        })
        .eq('event_id', eventId)
        .select()
        .single()

      if (updateError) throw updateError

      // Clear waitroom and create first round pairings in parallel
      // Round 1 uses the confirmed player order — no optimizer re-run
      await Promise.all([
        supabase.from('waitroom').delete().eq('event_id', eventId),
        createPairings(eventId, 1, selectedOrder),
      ])

      if (data) currentEvent.value = data

      return { success: true as const, data }
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
   * Advance to the next round: calculate scores from round results, update standings,
   * increment round, and create new pairings (or end the event).
   */
  async function nextRound(eventId: number, currentRound: number, playerOrder?: number[]) {
    beginLoading()
    error.value = null

    try {
      const { ruleset, posValues, eventRoundNumber } = await resolveEventRuleset(supabase, eventId)
      const { pairings, results, standingsMap } = await fetchRoundData(supabase, eventId, currentRound)

      calculateRoundScores(pairings, results, standingsMap, posValues, ruleset)
      await updateStandingsAndRanks(supabase, eventId, standingsMap)
      await fetchStandings(eventId)

      const { error: roundError } = await supabase
        .from('events')
        .update({ event_current_round: currentRound + 1 })
        .eq('event_id', eventId)

      if (roundError) throw roundError

      const hasEnded = (currentRound + 1) > (eventRoundNumber ?? 0)

      if (hasEnded) {
        await supabase.from('events').update({ event_playing: false }).eq('event_id', eventId)
      }
      else {
        await createPairings(eventId, currentRound + 1, playerOrder)
      }

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
   * Go back to the previous round, or to registration state if currently in round 1.
   * When going back from round 1, restores players to the waitroom.
   */
  async function turnBackRound(eventId: number, currentRound: number, leagueId: number) {
    beginLoading()
    error.value = null

    try {
      if (currentRound > 1) {
        // Decrement round and delete current pairings in parallel
        await Promise.all([
          supabase
            .from('events')
            .update({ event_current_round: currentRound - 1, event_playing: true })
            .eq('event_id', eventId),
          supabase
            .from('pairings')
            .delete()
            .eq('event_id', eventId)
            .eq('pairing_round', currentRound),
        ])
      }
      else {
        // Round 1 → back to registration: fetch players from standings before wiping
        const { data: standingsData } = await supabase
          .from('standings')
          .select('player_id')
          .eq('event_id', eventId)

        const playerIds = standingsData?.map(s => s.player_id) ?? []

        // Reset event + wipe standings + wipe pairings + restore waitroom in parallel
        await Promise.all([
          supabase
            .from('events')
            .update({
              event_current_round: 0,
              event_playing: false,
              event_registration_open: true,
            })
            .eq('event_id', eventId),
          supabase.from('standings').delete().eq('event_id', eventId),
          supabase.from('pairings').delete().eq('event_id', eventId),
          // Restore players to waitroom
          ...playerIds.map(playerId =>
            supabase.from('waitroom').insert({ event_id: eventId, player_id: playerId })
          ),
        ])
      }

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

  // ── Actions: Pairing generation & optimization ───────────────────────────────

  /**
   * Generates and saves pairings for a given round.
   *
   * When a `playerOrder` is provided (round 1), tables are built by sequentially
   * slicing the array according to table sizes — no optimization is performed.
   * This ensures the pairings match exactly what the user confirmed in the preview.
   *
   * Without `playerOrder` (rounds 2+), the function fetches standings and historical
   * pairings, then runs the full pairing optimizer (greedy seed + local swap) to
   * produce balanced tables based on scores, ranks, and forbidden pairs.
   */
  async function createPairings(eventId: number, round: number, playerOrder?: number[]) {
    try {
      if (playerOrder !== undefined) {
        await insertRoundOnePairings(supabase, eventId, round, playerOrder)
        return
      }

      await insertOptimizedPairings(supabase, eventId, round)
    }
    catch (err) {
      console.error('[useEventStore] createPairings error:', err)
      throw err  // re-throw so callers (startEvent, nextRound) can catch it
    }
  }

  /** Build round-1 pairings from a fixed player order (no optimizer). */
  async function insertRoundOnePairings(
    supabaseClient: ReturnType<typeof useSupabaseClient<Database>>,
    eventId: number,
    round: number,
    playerOrder: number[],
  ) {
    const tables = buildRoundOneTables(playerOrder)
    const rows = buildPairingRows(eventId, round, tables)

    if (!rows.length) {
      console.warn('[useEventStore] createPairings: playerOrder produced no valid tables')
      return
    }

    const { error } = await supabaseClient.from('pairings').insert(rows)
    if (error) throw error
  }

  /** Build tables for round 1 by slicing the player order into 4s then 3s. */
  function buildRoundOneTables(playerOrder: number[]): number[][] {
    const tables3 = (4 - (playerOrder.length % 4)) % 4
    const tables4 = (playerOrder.length - tables3 * 3) / 4
    const sizes = [
      ...Array.from({ length: tables4 }, () => 4),
      ...Array.from({ length: tables3 }, () => 3),
    ]

    const tables: number[][] = []
    let cursor = 0
    for (const size of sizes) {
      tables.push(playerOrder.slice(cursor, cursor + size))
      cursor += size
    }
    return tables
  }

  /** Fetch standings + history and run the pairing optimizer for round 2+. */
  async function insertOptimizedPairings(supabaseClient: ReturnType<typeof useSupabaseClient<Database>>, eventId: number, round: number) {
    const { data: standingsData, error: standingsError } = await supabaseClient
      .from('standings')
      .select('player_id, standing_player_rank, standing_player_score')
      .eq('event_id', eventId)
      .order('standing_player_rank', { ascending: true })

    if (standingsError) throw standingsError
    if (!standingsData?.length) {
      console.warn('[useEventStore] createPairings: no standings found for event', eventId)
      return
    }

    const history = await fetchPairingHistoryForOptimizer(supabaseClient, eventId, round)
    const scoringPlayers = buildScoringPlayers(standingsData, history)

    const preferences = getPairingPreferences(eventId)
    const optimized = optimizePairings({
      players: scoringPlayers,
      history,
      forbiddenPairs: preferences.forbiddenPairs,
      weights: preferences.weights,
      currentRound: round,
    })

    if (!optimized.tables.length || !Number.isFinite(optimized.totalScore)) {
      throw new Error(t('store.event.optimizerFailed'))
    }

    const rows = buildPairingRows(eventId, round, optimized.tables)
    if (!rows.length) {
      console.warn('[useEventStore] createPairings: optimizer produced no valid tables')
      return
    }

    const { error: insertError } = await supabaseClient.from('pairings').insert(rows)
    if (insertError) throw insertError
  }

  /** Fetch historical pairings for an event and map them to history entries. */
  async function fetchPairingHistoryForOptimizer(supabaseClient: ReturnType<typeof useSupabaseClient<Database>>, eventId: number, round: number): Promise<PairingHistoryEntry[]> {
    const { data, error } = await supabaseClient
      .from('pairings')
      .select('pairing_round, pairing_player1_id, pairing_player2_id, pairing_player3_id, pairing_player4_id')
      .eq('event_id', eventId)
      .lt('pairing_round', round)

    if (error) throw error
    return mapPairingsToHistory(data)
  }

  /** Build scoring players from standings + historical table-3 counts. */
  function buildScoringPlayers(
    standingsData: Pick<Standing, 'player_id' | 'standing_player_rank' | 'standing_player_score'>[],
    history: PairingHistoryEntry[],
  ): PairingPlayer[] {
    const table3Counter = new Map<number, number>()
    for (const entry of history) {
      if (entry.players.length !== 3) continue
      for (const playerId of entry.players) {
        table3Counter.set(playerId, (table3Counter.get(playerId) ?? 0) + 1)
      }
    }

    return standingsData.map((standing) => ({
      id: standing.player_id,
      rank: standing.standing_player_rank ?? UNRANKED_FALLBACK,
      score: standing.standing_player_score ?? 0,
      table3Count: table3Counter.get(standing.player_id) ?? 0,
    }))
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

  /**
   * Generic upsert helper for the round_results table.
   * Checks for an existing row by (pairing_id, player_id) and updates or inserts.
   */
  async function upsertRoundResult(
    pairingId: number,
    playerId: number,
    data: Partial<Omit<RoundResult, 'id' | 'pairing_id' | 'player_id'>>,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: existing } = await supabase
        .from('round_results')
        .select('id')
        .eq('pairing_id', pairingId)
        .eq('player_id', playerId)
        .maybeSingle()

      console.log('[upsertRoundResult] Existing row?', { pairingId, playerId, existing: !!existing })
      if (existing) {
        const { error } = await supabase
          .from('round_results')
          .update(data)
          .eq('pairing_id', pairingId)
          .eq('player_id', playerId)
        if (error) throw error
        console.log('[upsertRoundResult] Updated existing row', { pairingId, playerId, data })
      }
      else {
        const { error } = await supabase
          .from('round_results')
          .insert({ pairing_id: pairingId, player_id: playerId, ...data })
        if (error) throw error
        console.log('[upsertRoundResult] Inserted new row', { pairingId, playerId, data })
      }

      return { success: true }
    }
    catch (err) {
      console.error('[upsertRoundResult] Error', { pairingId, playerId, data, err })
      return { success: false, error: toErrorMessage(err, t('store.event.saveError')) }
    }
  }

  /** Insert a new round result */
  async function submitRoundResult(result: RoundResultInsert) {
    try {
      const { error: supaError } = await supabase
        .from('round_results')
        .insert([{
          player_id: result.player_id,
          pairing_id: result.pairing_id,
          position: result.position,
          number_of_kills: result.number_of_kills,
          brew_vote: result.brew_vote,
          play_vote_1: result.play_vote_1,
          play_vote_2: result.play_vote_2,
          commander_1: result.commander_1,
          commander_2: result.commander_2,
        }])

      if (supaError) throw supaError
    }
    catch (err) {
      console.error('[useEventStore] submitRoundResult error:', err)
      throw err
    }
  }

  /** Update an existing round result by pairing and player */
  async function updateRoundResult(pairingId: number, playerId: number, result: RoundResultInsert) {
    try {
      const { error: supaError } = await supabase
        .from('round_results')
        .update({
          position: result.position,
          number_of_kills: result.number_of_kills,
          brew_vote: result.brew_vote,
          play_vote_1: result.play_vote_1,
          play_vote_2: result.play_vote_2,
          commander_1: result.commander_1,
          commander_2: result.commander_2,
        })
        .eq('pairing_id', pairingId)
        .eq('player_id', playerId)

      if (supaError) throw supaError
    }
    catch (err) {
      console.error('[useEventStore] updateRoundResult error:', err)
      throw err
    }
  }

  /** Save a player's brew and play votes via the upsert helper */
  async function saveVote(pairingId: number, playerId: number, brewVote: number | null, playVote: number | null): Promise<{ success: boolean; error?: string }> {
    console.log('[useEventStore] saveVote called', { pairingId, playerId, brewVote, playVote })
    const result = await upsertRoundResult(pairingId, playerId, { brew_vote: brewVote, play_vote_1: playVote })
    if (!result.success) {
      console.error('[useEventStore] saveVote error:', result.error)
      return { success: false, error: result.error || t('store.event.voteSaveError') }
    }
    console.log('[useEventStore] saveVote success', { pairingId, playerId })
    return result
  }

  /** Save a player's commanders via the upsert helper */
  async function saveCommander(pairingId: number, playerId: number, commander1: string | null, commander2: string | null = null): Promise<{ success: boolean; error?: string }> {
    console.log('[useEventStore] saveCommander called', { pairingId, playerId, commander1, commander2 })
    const result = await upsertRoundResult(pairingId, playerId, { commander_1: commander1, commander_2: commander2 })
    if (!result.success) {
      console.error('[useEventStore] saveCommander error:', result.error)
      return { success: false, error: result.error || t('store.event.commanderSaveError') }
    }
    console.log('[useEventStore] saveCommander success', { pairingId, playerId })
    return result
  }

  /** Save player rankings (positions) for a pairing via the upsert helper */
  async function savePairingRankings(pairingId: number, rankings: { playerId: number; position: number }[]): Promise<{ success: boolean; error?: string }> {
    try {
      for (const { playerId, position } of rankings) {
        const result = await upsertRoundResult(pairingId, playerId, { position })
        if (!result.success) throw new Error(result.error)
      }
      return { success: true }
    }
    catch (err) {
      console.error('[useEventStore] savePairingRankings error:', err)
      return { success: false, error: toErrorMessage(err, t('store.event.rankingsSaveError')) }
    }
  }

  /** Save kill counts for a pairing via the upsert helper */
  async function savePairingKills(pairingId: number, killCounts: { playerId: number; count: number }[]): Promise<{ success: boolean; error?: string }> {
    try {
      for (const { playerId, count } of killCounts) {
        const result = await upsertRoundResult(pairingId, playerId, { number_of_kills: count })
        if (!result.success) throw new Error(result.error)
      }
      return { success: true }
    }
    catch (err) {
      console.error('[useEventStore] savePairingKills error:', err)
      return { success: false, error: toErrorMessage(err, t('store.event.killsSaveError')) }
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

    // Actions — pairing generation & optimization
    createPairings,
    fetchPairings,
    fetchPairingHistory,

    // Actions — round result submission
    submitRoundResult,
    updateRoundResult,
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
