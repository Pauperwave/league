import type { Event, EventInsert, Standing, StandingWithPlayer, Pairing, RoundResultInsert } from '#shared/utils/types'
import { sanitizePlayer } from './players'

// ─── Utility ────────────────────────────────────────────────────────────────
function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

// ─── Store ──────────────────────────────────────────────────────────────────
export const useEventStore = defineStore('events', () => {
  const supabase = useSupabaseClient()

  // ── State ──────────────────────────────────────────────────────────────────
  const events        = ref<Event[]>([])
  const currentEvent  = ref<Event | null>(null)
  const standings     = ref<StandingWithPlayer[]>([])
  const pairings      = ref<Pairing[]>([])
  const loadingCount  = ref(0)          // counter instead of boolean
  const error         = ref<string | null>(null)
  const initialized   = ref<Record<number, boolean>>({})

  // ── Derived loading state ──────────────────────────────────────────────────
  // Stays true as long as ANY async action is in flight
  const loading = computed(() => loadingCount.value > 0)

  function beginLoading() { loadingCount.value++ }
  function endLoading()   { loadingCount.value = Math.max(0, loadingCount.value - 1) }

  // ── Getters ────────────────────────────────────────────────────────────────
  const getEventsByLeagueId = computed(() => (leagueId: number) =>
    events.value.filter(e => e.league_id === leagueId)
  )

  const isEventEnded = computed(() => {
    if (!currentEvent.value) return false
    return (currentEvent.value.event_current_round ?? 0) > (currentEvent.value.event_round_number ?? 0)
  })
  // ── Actions ────────────────────────────────────────────────────────────────

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

      initialized.value[leagueId] = true
    }
    catch (err) {
      error.value = toErrorMessage(err, 'Errore nel caricamento eventi')
      console.error('[useEventStore] fetchEvents error:', err)
    }
    finally {
      endLoading()
    }
  }

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
      error.value = toErrorMessage(err, 'Errore nella creazione evento')
      console.error('[useEventStore] createEvent error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }

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
      error.value = toErrorMessage(err, "Errore nell'eliminazione evento")
      console.error('[useEventStore] deleteEvent error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }
  async function startEvent(eventId: number) {
    beginLoading()
    error.value = null

    try {
      const { data: waitingPlayers, error: waitingError } = await supabase
        .from('waitroom')
        .select('player_id')
        .eq('event_id', eventId)

      if (waitingError) throw waitingError

      const count = waitingPlayers?.length ?? 0
      if (count < 3 || count === 5) {
        throw new Error('Numero giocatori non valido (min 3, non 5)')
      }

      // Shuffle for random initial ranking
      const shuffled = [...waitingPlayers].sort(() => Math.random() - 0.5)

      const standingsData = shuffled.map((player, index) => ({
        event_id:              eventId,
        player_id:             player.player_id,
        standing_player_score: 0,
        standing_player_rank:  index + 1,
        victories:             0,
        brew_received:         0,
        play_received:         0,
      }))

      const { error: standingsError } = await supabase
        .from('standings')
        .insert(standingsData)

      if (standingsError) throw standingsError

      const { data, error: updateError } = await supabase
        .from('events')
        .update({
          event_playing:           true,
          event_current_round:     1,
          event_registration_open: false,
        })
        .eq('event_id', eventId)
        .select()
        .single()

      if (updateError) throw updateError

      // Clear waitroom and create first round pairings in parallel
      await Promise.all([
        supabase.from('waitroom').delete().eq('event_id', eventId),
        createPairings(eventId, 1),
      ])

      if (data) currentEvent.value = data

      return { success: true as const, data }
    }
    catch (err) {
      error.value = toErrorMessage(err, "Errore nell'avvio evento")
      console.error('[useEventStore] startEvent error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }

  async function createPairings(eventId: number, round: number) {
    try {
      const { data: standingsData, error: standingsError } = await supabase
        .from('standings')
        .select('player_id')
        .eq('event_id', eventId)
        .order('standing_player_rank', { ascending: true })

      if (standingsError) throw standingsError
      if (!standingsData?.length) return

      const playerIds = standingsData.map(s => s.player_id)

      // Build all rows in memory — single batch insert, no per-table update needed
      type PairingInsert = {
        event_id:           number
        pairing_round:      number
        pairing_is_full:    boolean
        pairing_player1_id: number | null
        pairing_player2_id: number | null
        pairing_player3_id: number | null
        pairing_player4_id: number | null
      }

      const rows: PairingInsert[] = []

      for (let i = 0; i < playerIds.length; i += 4) {
        const table = playerIds.slice(i, i + 4)
        if (table.length < 3) break  // skip incomplete tables (shouldn't happen post-validation)

        rows.push({
          event_id:           eventId,
          pairing_round:      round,
          pairing_is_full:    table.length === 4,
          pairing_player1_id: table[0] ?? null,
          pairing_player2_id: table[1] ?? null,
          pairing_player3_id: table[2] ?? null,
          pairing_player4_id: table[3] ?? null,
        })
      }

      if (!rows.length) return

      const { error: insertError } = await supabase.from('pairings').insert(rows)
      if (insertError) throw insertError
    }
    catch (err) {
      console.error('[useEventStore] createPairings error:', err)
      throw err  // re-throw so callers (startEvent, nextRound) can catch it
    }
  }
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

      standings.value = (data ?? []).map(s => ({
        ...s,
        players: s.players
          ? sanitizePlayer({
              player_id:      s.players.player_id,
              player_name:    s.players.player_name,
              player_surname: s.players.player_surname,
            })
          : undefined,
      }))
    }
    catch (err) {
      console.error('[useEventStore] fetchStandings error:', err)
    }
  }

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
              player_id:      s.players.player_id,
              player_name:    s.players.player_name,
              player_surname: s.players.player_surname,
            })
          : undefined,
      }))
    }
    catch (err) {
      console.error('[useEventStore] fetchMultipleEventStandings error:', err)
      return []
    }
  }

  async function fetchLeagueStandings(leagueId: number) {
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('event_id')
        .eq('league_id', leagueId)

      if (eventsError) throw eventsError
      if (!eventsData?.length) { standings.value = []; return }

      const eventIds = eventsData.map(e => e.event_id)

      const { data: standingsData, error: standingsError } = await supabase
        .from('standings')
        .select(`
          player_id,
          standing_player_score,
          victories,
          brew_received,
          play_received,
          players:player_id (player_id, player_name, player_surname)
        `)
        .in('event_id', eventIds)

      if (standingsError) throw standingsError

      const playerMap = new Map<number, StandingWithPlayer>()

      for (const s of standingsData ?? []) {
        const existing = playerMap.get(s.player_id)
        if (existing) {
          existing.standing_player_score = (existing.standing_player_score ?? 0) + (s.standing_player_score ?? 0)
          existing.victories             = (existing.victories             ?? 0) + (s.victories             ?? 0)
          existing.brew_received         = (existing.brew_received         ?? 0) + (s.brew_received         ?? 0)
          existing.play_received         = (existing.play_received         ?? 0) + (s.play_received         ?? 0)
        }
        else {
          playerMap.set(s.player_id, {
            standing_id:           0,
            event_id:              null,
            player_id:             s.player_id,
            standing_player_score: s.standing_player_score ?? 0,
            standing_player_rank:  null,
            victories:             s.victories             ?? 0,
            brew_received:         s.brew_received         ?? 0,
            play_received:         s.play_received         ?? 0,
            players: s.players
              ? sanitizePlayer({
                  player_id:      s.players.player_id,
                  player_name:    s.players.player_name,
                  player_surname: s.players.player_surname,
                })
              : undefined,
          })
        }
      }

      standings.value = Array.from(playerMap.values()).sort(
        (a, b) => (b.standing_player_score ?? 0) - (a.standing_player_score ?? 0)
      )
    }
    catch (err) {
      console.error('[useEventStore] fetchLeagueStandings error:', err)
    }
  }

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

      const validEventIds = ruleset?.rule_set_valid_events  ?? 0
      const participation = ruleset?.rule_set_partecipation ?? 0
      const eventIds      = eventsRes.data.map(e => e.event_id)

      const { data: standingsData, error: standingsError } = await supabase
        .from('standings')
        .select(`
          player_id,
          standing_player_score,
          victories,
          brew_received,
          play_received,
          standing_player_rank,
          players:player_id (player_id, player_name, player_surname)
        `)
        .in('event_id', eventIds)

      if (standingsError) throw standingsError

      type PlayerAccumulator = {
        player_id:     number
        scores:        number[]
        victories:     number
        brew_received: number
        play_received: number
        players?:      { player_id: number, player_name: string, player_surname: string }
      }

      const playerMap = new Map<number, PlayerAccumulator>()

      for (const s of standingsData ?? []) {
        const existing = playerMap.get(s.player_id)
        if (existing) {
          existing.scores.push(s.standing_player_score ?? 0)
          existing.victories     += s.victories     ?? 0
          existing.brew_received += s.brew_received ?? 0
          existing.play_received += s.play_received ?? 0
        }
        else {
          playerMap.set(s.player_id, {
            player_id:     s.player_id,
            scores:        [s.standing_player_score ?? 0],
            victories:     s.victories     ?? 0,
            brew_received: s.brew_received ?? 0,
            play_received: s.play_received ?? 0,
            players:       s.players ?? undefined,   // kept as raw join for accumulation
          })
        }
      }

      const results = Array.from(playerMap.values()).map((p) => {
        const sortedScores       = [...p.scores].sort((a, b) => b - a)
        const sum                = sortedScores.slice(0, validEventIds).reduce((a, b) => a + b, 0)
        const participationBonus = participation * p.scores.length

        return {
          ...p,
          totalScore:     sum + participationBonus,
          participations: p.scores.length,
        }
      })

      results.sort((a, b) => {
        if (b.totalScore     !== a.totalScore)     return b.totalScore     - a.totalScore
        if (b.participations !== a.participations) return b.participations - a.participations
        if (b.victories      !== a.victories)      return b.victories      - a.victories
        if (b.brew_received  !== a.brew_received)  return b.brew_received  - a.brew_received
        return Math.random() - 0.5
      })

      standings.value = results.map((r, index) => ({
        standing_id:           0,
        event_id:              null,
        player_id:             r.player_id,
        standing_player_score: r.totalScore,
        standing_player_rank:  index + 1,
        victories:             r.victories,
        brew_received:         r.brew_received,
        play_received:         r.play_received,
        players: r.players                      // ✅ sanitized at assignment time
          ? sanitizePlayer({
              player_id:      r.players.player_id,
              player_name:    r.players.player_name,
              player_surname: r.players.player_surname,
            })
          : undefined,
      }))
    }
    catch (err) {
      console.error('[useEventStore] fetchLeagueResults error:', err)
    }
  }

  async function fetchPairings(eventId: number, round: number) {
    try {
      const { data, error: supaError } = await supabase
        .from('pairings')
        .select(`
          *,
          round_results (*)
        `)
        .eq('event_id', eventId)
        .eq('pairing_round', round)
        .order('pairing_id')

      if (supaError) throw supaError
      pairings.value = data ?? []
    }
    catch (err) {
      console.error('[useEventStore] fetchPairings error:', err)
    }
  }

  async function submitRoundResult(result: RoundResultInsert) {
    try {
      // RoundResultInsert already maps 1:1 to the table columns — spread directly
      const { error: supaError } = await supabase
        .from('round_results')
        .insert([{
          player_id:       result.player_id,
          pairing_id:      result.pairing_id,
          position:        result.position,
          number_of_kills: result.number_of_kills,
          brew_vote:       result.brew_vote,
          play_vote_1:     result.play_vote_1,
          play_vote_2:     result.play_vote_2,
          commander_1:     result.commander_1,
          commander_2:     result.commander_2,
        }])

      if (supaError) throw supaError
    }
    catch (err) {
      console.error('[useEventStore] submitRoundResult error:', err)
      throw err  // re-throw — callers need to handle submission failures
    }
  }

  async function updateRoundResult(pairingId: number, playerId: number, result: RoundResultInsert) {
    try {
      const { error: supaError } = await supabase
        .from('round_results')
        .update({
          position:        result.position,
          number_of_kills: result.number_of_kills,
          brew_vote:       result.brew_vote,
          play_vote_1:     result.play_vote_1,
          play_vote_2:     result.play_vote_2,
          commander_1:     result.commander_1,
          commander_2:     result.commander_2,
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

  async function nextRound(eventId: number, currentRound: number) {
    beginLoading()
    error.value = null

    try {
      // ── 1. Resolve ruleset ────────────────────────────────────────────────
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

      // ── 2. Fetch all pairings for this round ──────────────────────────────
      const { data: pairingsData, error: pairingsError } = await supabase
        .from('pairings')
        .select('*')
        .eq('event_id', eventId)
        .eq('pairing_round', currentRound)

      if (pairingsError) throw pairingsError

      const pairingIds = (pairingsData ?? []).map(p => p.pairing_id)

      // ── 3. Fetch ALL round results for all pairings in one query ──────────
      const { data: allResults, error: allResultsError } = await supabase
        .from('round_results')
        .select('*')
        .in('pairing_id', pairingIds)

      if (allResultsError) throw allResultsError

      // ── 4. Fetch ALL current standings in one query ───────────────────────
      const { data: currentStandings, error: currentStandingsError } = await supabase
        .from('standings')
        .select('player_id, standing_player_score, victories, brew_received, play_received')
        .eq('event_id', eventId)

      if (currentStandingsError) throw currentStandingsError

      type StandingAccumulator = {
        player_id:             number
        standing_player_score: number
        victories:             number
        brew_received:         number
        play_received:         number
      }

      const standingsMap = new Map<number, StandingAccumulator>(
        (currentStandings ?? []).map(s => [s.player_id, {
          player_id:             s.player_id,
          standing_player_score: s.standing_player_score ?? 0,
          victories:             s.victories             ?? 0,
          brew_received:         s.brew_received         ?? 0,
          play_received:         s.play_received         ?? 0,
        }])
      )

      // ── 5. Calculate scores entirely in memory ────────────────────────────
      for (const pairing of pairingsData ?? []) {
        const playerIds = ([
          pairing.pairing_player1_id,
          pairing.pairing_player2_id,
          pairing.pairing_player3_id,
          pairing.pairing_player4_id,
        ] as Array<number | null>).filter((pid): pid is number => pid !== null)

        const tableResults = (allResults ?? []).filter(r => r.pairing_id === pairing.pairing_id)

        for (const playerId of playerIds) {
          const myResult = tableResults.find(r => r.player_id === playerId)
          if (!myResult) continue

          const position      = myResult.position        ?? 0
          const numberOfKills = myResult.number_of_kills ?? 0

          // Votes from everyone else at the table
          const otherResults   = tableResults.filter(r => r.player_id !== playerId)
          const brewVote       = otherResults.filter(r => r.brew_vote === playerId).length
          const totalPlayCount = otherResults.filter(
            r => r.play_vote_1 === playerId || r.play_vote_2 === playerId
          ).length

          // Tied-position score averaging
          const samePositionCount = position !== 0
            ? tableResults.filter(r => r.position === position).length
            : 1

          let rankSum = 0
          for (let i = 0; i < samePositionCount; i++) {
            rankSum += posValues[Math.min(position + i, 4)] ?? 0
          }
          const scoreRank = Math.floor(rankSum / samePositionCount)

          const totalScore = scoreRank
            + numberOfKills  * (ruleset?.rule_set_kill  ?? 0)
            + brewVote       * (ruleset?.rule_set_brew  ?? 0)
            + totalPlayCount * (ruleset?.rule_set_play  ?? 0)

          const acc = standingsMap.get(playerId)
          if (acc) {
            acc.standing_player_score += totalScore
            acc.victories             += position === 1 ? 1 : 0
            acc.brew_received         += brewVote
            acc.play_received         += totalPlayCount
          }
        }
      }

      // ── 6. Batch update scores ────────────────────────────────────────────
      await Promise.all(
        Array.from(standingsMap.values()).map(s =>
          supabase
            .from('standings')
            .update({
              standing_player_score: s.standing_player_score,
              victories:             s.victories,
              brew_received:         s.brew_received,
              play_received:         s.play_received,
            })
            .eq('event_id', eventId)
            .eq('player_id', s.player_id)
        )
      )

      // ── 7. Persist updated ranks to DB ────────────────────────────────────
      const ranked = Array.from(standingsMap.values()).sort(
        (a, b) => b.standing_player_score - a.standing_player_score
      )
      await Promise.all(
        ranked.map((s, index) =>
          supabase
            .from('standings')
            .update({ standing_player_rank: index + 1 })
            .eq('event_id', eventId)
            .eq('player_id', s.player_id)
        )
      )

      // Refresh local standings state from DB
      await fetchStandings(eventId)

      // ── 8. Increment round ────────────────────────────────────────────────
      const { error: roundError } = await supabase
        .from('events')
        .update({ event_current_round: currentRound + 1 })
        .eq('event_id', eventId)

      if (roundError) throw roundError

      // ── 9. Check if event has ended ───────────────────────────────────────
      const hasEnded = (currentRound + 1) > (eventData.event_round_number ?? 0)

      if (hasEnded) {
        await supabase
          .from('events')
          .update({ event_playing: false })
          .eq('event_id', eventId)
      }
      else {
        await createPairings(eventId, currentRound + 1)
      }

      return { success: true as const }
    }
    catch (err) {
      error.value = toErrorMessage(err, 'Errore nel prossimo round')
      console.error('[useEventStore] nextRound error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }

  async function turnBackRound(eventId: number, currentRound: number, leagueId: number) {
    beginLoading()
    error.value = null

    try {
      if (currentRound > 1) {
        // Decrement round and delete current pairings in parallel
        await Promise.all([
          supabase
            .from('events')
            .update({ event_current_round: currentRound - 1 })
            .eq('event_id', eventId),
          supabase
            .from('pairings')
            .delete()
            .eq('event_id', eventId)
            .eq('pairing_round', currentRound),
        ])
      }
      else {
        // Round 1 → back to registration: reset event + wipe standings + wipe pairings in parallel
        await Promise.all([
          supabase
            .from('events')
            .update({
              event_current_round:     0,
              event_playing:           false,
              event_registration_open: true,
            })
            .eq('event_id', eventId),
          supabase.from('standings').delete().eq('event_id', eventId),
          supabase.from('pairings').delete().eq('event_id', eventId),
        ])
      }

      await fetchEvents(leagueId, true)
    }
    catch (err) {
      error.value = toErrorMessage(err, 'Errore nel tornare indietro')
      console.error('[useEventStore] turnBackRound error:', err)
    }
    finally {
      endLoading()
    }
  }

  function setCurrentEvent(event: Event | null) {
    currentEvent.value = event
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    // State
    events,
    currentEvent,
    standings,
    pairings,
    loading,        // now a computed, stays true while ANY action is in flight
    error,

    // Getters
    getEventsByLeagueId,
    isEventEnded,

    // Actions — event lifecycle
    fetchEvents,
    createEvent,
    deleteEvent,
    startEvent,
    nextRound,
    turnBackRound,
    setCurrentEvent,

    // Actions — round data
    createPairings,
    fetchPairings,
    submitRoundResult,
    updateRoundResult,

    // Actions — standings
    fetchStandings,
    fetchMultipleEventStandings,
    fetchLeagueStandings,
    fetchLeagueResults,
  }
})
