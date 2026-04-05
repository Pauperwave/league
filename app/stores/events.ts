import type { Event, NewEvent, Standing, Pairing, NewRoundResult } from '~/types/database'
import { sanitizePlayer } from './players'

export const useEventStore = defineStore('events', () => {
  const supabase = useSupabaseClient()

  // State
  const events = ref<Event[]>([])
  const currentEvent = ref<Event | null>(null)
  const standings = ref<Standing[]>([])
  const pairings = ref<Pairing[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref<Record<number, boolean>>({})

  // Getters
  const getEventsByLeagueId = computed(() => (leagueId: number) => {
    return events.value.filter(e => e.league_id === leagueId)
  })

  const isEventEnded = computed(() => {
    if (!currentEvent.value) return false
    return (currentEvent.value.event_current_round || 0) > (currentEvent.value.event_round_number || 0)
  })

  // Actions
  async function fetchEvents(leagueId: number, force = false) {
    if (initialized.value[leagueId] && !force) return

    loading.value = true
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('events')
        .select('*')
        .eq('league_id', leagueId)
        .order('event_datetime', { ascending: false })

      if (supaError) throw supaError

      // Merge new data instead of replacing
      const newEvents = data || []
      const existingIds = new Set(events.value.map(e => e.event_id))
      newEvents.forEach((event) => {
        if (!existingIds.has(event.event_id)) {
          events.value.push(event)
        }
      })
      initialized.value[leagueId] = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore nel caricamento eventi'
      console.error('[useEventStore] fetchEvents error:', err)
    } finally {
      loading.value = false
    }
  }

  async function createEvent(event: NewEvent) {
    loading.value = true
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('events')
        .insert([{
          event_name: event.event_name,
          league_id: event.league_id,
          event_datetime: event.event_datetime,
          event_round_number: event.event_round_number,
          event_current_round: 0,
          event_registration_open: true,
          event_playing: false
        }])
        .select()
        .single()

      if (supaError) throw supaError

      if (data) {
        events.value.unshift(data)
        return { success: true as const, data }
      }
      return { success: false as const, error: 'No data returned' }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore nella creazione evento'
      console.error('[useEventStore] createEvent error:', err)
      return { success: false as const, error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function deleteEvent(eventId: number) {
    loading.value = true
    error.value = null

    try {
      const { error: supaError } = await supabase.from('events').delete().eq('event_id', eventId)
      if (supaError) throw supaError

      events.value = events.value.filter(e => e.event_id !== eventId)
      if (currentEvent.value?.event_id === eventId) {
        currentEvent.value = null
      }
      return { success: true }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore nell\'eliminazione evento'
      console.error('[useEventStore] deleteEvent error:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function startEvent(eventId: number) {
    loading.value = true
    error.value = null

    try {
      // Get waiting players
      const { data: waitingPlayers, error: waitingError } = await supabase
        .from('waitroom')
        .select('player_id')
        .eq('event_id', eventId)

      if (waitingError) throw waitingError

      if (!waitingPlayers || waitingPlayers.length < 3 || waitingPlayers.length === 5) {
        throw new Error('Numero giocatori non valido (min 3, non 5)')
      }

      // Shuffle players for random ranking
      const shuffledPlayers = [...waitingPlayers].sort(() => Math.random() - 0.5)

      // Create standings
      const standingsData = shuffledPlayers.map((player, index) => ({
        event_id: eventId,
        player_id: player.player_id,
        standing_player_score: 0,
        standing_player_rank: index + 1,
        victories: 0,
        brew_received: 0,
        play_received: 0
      }))

      const { error: standingsError } = await supabase.from('standings').insert(standingsData)

      if (standingsError) throw standingsError

      // Update event status
      const { data, error: updateError } = await supabase
        .from('events')
        .update({
          event_playing: true,
          event_current_round: 1,
          event_registration_open: false
        })
        .eq('event_id', eventId)
        .select()
        .single()

      if (updateError) throw updateError

      // Clear waitroom
      await supabase.from('waitroom').delete().eq('event_id', eventId)

      // Create first round pairings
      await createPairings(eventId, 1)

      if (data) {
        currentEvent.value = data
      }

      return { success: true, data }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore nell\'avvio evento'
      console.error('[useEventStore] startEvent error:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function createPairings(eventId: number, round: number) {
    try {
      // Get standings for pairings
      const { data: standingsData, error: standingsError } = await supabase
        .from('standings')
        .select('player_id')
        .eq('event_id', eventId)
        .order('standing_player_rank', { ascending: true })

      if (standingsError) throw standingsError

      if (!standingsData) return

      // Create Swiss-style pairings
      const playerIds = standingsData.map(s => s.player_id)
      const tables: number[][] = []

      // Handle tables of 4 players each, last table can be 3 if needed
      for (let i = 0; i < playerIds.length; i += 4) {
        const table = playerIds.slice(i, i + 4)
        if (table.length >= 3) {
          tables.push(table)
        }
      }

      // Insert pairings
      for (let i = 0; i < tables.length; i++) {
        const { data: pairing, error: pairingError } = await supabase
          .from('pairings')
          .insert([
            {
              event_id: eventId,
              pairing_round: round,
              pairing_is_full: tables[i]?.length === 4
            }
          ])
          .select()
          .single()

        if (pairingError) throw pairingError

        // Update pairing with player IDs
        if (pairing) {
          const updateData: Record<string, number | null> = {
            pairing_player1_id: tables[i]?.[0] || null,
            pairing_player2_id: tables[i]?.[1] || null,
            pairing_player3_id: tables[i]?.[2] || null,
            pairing_player4_id: tables[i]?.[3] || null
          }

          await supabase.from('pairings').update(updateData).eq('pairing_id', pairing.pairing_id)
        }
      }
    } catch (err) {
      console.error('[useEventStore] createPairings error:', err)
      throw err
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
      standings.value = (data || []).map(s => ({
        ...s,
        players: s.players
          ? sanitizePlayer({
              player_id: s.players.player_id,
              player_name: s.players.player_name,
              player_surname: s.players.player_surname
            })
          : undefined
      }))
    } catch (err) {
      console.error('[useEventStore] fetchStandings error:', err)
    }
  }

  async function fetchLeagueStandings(leagueId: number) {
    try {
      // First, get all events for this league
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('event_id')
        .eq('league_id', leagueId)

      if (eventsError) throw eventsError
      if (!eventsData || eventsData.length === 0) {
        standings.value = []
        return
      }

      const eventIds = eventsData.map(e => e.event_id)

      // Get all standings for these events
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

      // Aggregate scores by player
      const playerScores = new Map<number, Standing>()

      for (const s of standingsData || []) {
        const existing = playerScores.get(s.player_id)
        if (existing) {
          existing.standing_player_score
            = (existing.standing_player_score || 0) + (s.standing_player_score || 0)
          existing.victories = (existing.victories || 0) + (s.victories || 0)
          existing.brew_received = (existing.brew_received || 0) + (s.brew_received || 0)
          existing.play_received = (existing.play_received || 0) + (s.play_received || 0)
        } else {
          playerScores.set(s.player_id, {
            standing_id: 0,
            event_id: null,
            player_id: s.player_id,
            standing_player_score: s.standing_player_score || 0,
            standing_player_rank: null,
            victories: s.victories || 0,
            brew_received: s.brew_received || 0,
            play_received: s.play_received || 0,
            players: s.players
              ? sanitizePlayer({
                  player_id: s.player_id,
                  player_name: s.players.player_name,
                  player_surname: s.players.player_surname
                })
              : undefined
          })
        }
      }

      // Convert to array and sort by score
      const aggregatedStandings = Array.from(playerScores.values()).sort(
        (a, b) => (b.standing_player_score || 0) - (a.standing_player_score || 0)
      )

      standings.value = aggregatedStandings
    } catch (err) {
      console.error('[useEventStore] fetchLeagueStandings error:', err)
    }
  }

  async function fetchLeagueResults(leagueId: number) {
    try {
      // 1. Get ruleset for the league
      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('ruleset_id')
        .eq('id', leagueId)
        .single()

      if (leagueError || !leagueData?.ruleset_id) throw new Error('No ruleset found')

      const { data: ruleset, error: rulesetError } = await supabase
        .from('rulesets')
        .select('*')
        .eq('ruleset_id', leagueData.ruleset_id)
        .single()

      if (rulesetError) throw rulesetError

      const valeventIds = ruleset?.rule_set_valid_events || 0
      const partecipation = ruleset?.rule_set_partecipation || 0

      // 2. Get all events for the league
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('event_id')
        .eq('league_id', leagueId)

      if (eventsError) throw eventsError
      if (!eventsData || eventsData.length === 0) {
        standings.value = []
        return
      }

      const eventIds = eventsData.map(e => e.event_id)

      // 3. Get all standings for these events
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

      // 4. Aggregate scores by player
      const playerScores = new Map<
        number,
        {
          player_id: number
          scores: number[]
          victories: number
          brew_received: number
          play_received: number
          players?: { player_id: number, player_name: string, player_surname: string }
        }
      >()

      for (const s of standingsData || []) {
        const existing = playerScores.get(s.player_id)
        if (existing) {
          existing.scores.push(s.standing_player_score || 0)
          existing.victories += s.victories || 0
          existing.brew_received += s.brew_received || 0
          existing.play_received += s.play_received || 0
        } else {
          playerScores.set(s.player_id, {
            player_id: s.player_id,
            scores: [s.standing_player_score || 0],
            victories: s.victories || 0,
            brew_received: s.brew_received || 0,
            play_received: s.play_received || 0,
            players: s.players
          })
        }
      }

      // 5. Calculate final scores with ruleset
      const results = Array.from(playerScores.values()).map((p) => {
        // Sort scores descending and take top N
        const sortedScores = [...p.scores].sort((a, b) => b - a)
        const validScores = sortedScores.slice(0, valeventIds)
        const sum = validScores.reduce((a, b) => a + b, 0)
        const partecipationBonus = partecipation * p.scores.length
        const totalScore = sum + partecipationBonus

        return {
          ...p,
          totalScore,
          partecipations: p.scores.length
        }
      })

      // 6. Sort with tie-breaker logic (same as Java)
      results.sort((a, b) => {
        // 1. Compare total score
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore
        }
        // 2. Compare partecipations
        if (b.partecipations !== a.partecipations) {
          return b.partecipations - a.partecipations
        }
        // 3. Compare first places (victories)
        if (b.victories !== a.victories) {
          return b.victories - a.victories
        }
        // 4. Compare brew_received
        if (b.brew_received !== a.brew_received) {
          return b.brew_received - a.brew_received
        }
        // 5. Random shuffle for remaining ties
        return Math.random() - 0.5
      })

      // 7. Convert to Standing format
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
      }))
    } catch (err) {
      console.error('[useEventStore] fetchLeagueResults error:', err)
    }
  }

  async function fetchPairings(eventId: number, round: number) {
    try {
      const { data, error: supaError } = await supabase
        .from('pairings')
        .select(`
          *,
          round_results(*)
        `)
        .eq('event_id', eventId)
        .eq('pairing_round', round)
        .order('pairing_id')

      if (supaError) throw supaError
      pairings.value = data || []
    } catch (err) {
      console.error('[useEventStore] fetchPairings error:', err)
    }
  }

  async function submitRoundResult(result: NewRoundResult) {
    try {
      const { error } = await supabase.from('round_results').insert([
        {
          player_id: result.player_id,
          pairing_id: result.pairing_id,
          position: result.position,
          number_of_kills: result.number_of_kills,
          brew_vote: result.brew_vote,
          play_vote_1: result.play_vote_1,
          play_vote_2: result.play_vote_2,
          commander_1: result.commander_1,
          commander_2: result.commander_2
        }
      ])

      if (error) throw error
    } catch (err) {
      console.error('[useEventStore] submitRoundResult error:', err)
      throw err
    }
  }

  async function updateRoundResult(pairingId: number, playerId: number, result: NewRoundResult) {
    try {
      const { error } = await supabase
        .from('round_results')
        .update({
          position: result.position,
          number_of_kills: result.number_of_kills,
          brew_vote: result.brew_vote,
          play_vote_1: result.play_vote_1,
          play_vote_2: result.play_vote_2,
          commander_1: result.commander_1,
          commander_2: result.commander_2
        })
        .eq('pairing_id', pairingId)
        .eq('player_id', playerId)

      if (error) throw error
    } catch (err) {
      console.error('[useEventStore] updateRoundResult error:', err)
      throw err
    }
  }

  async function nextRound(eventId: number, currentRound: number) {
    loading.value = true
    error.value = null

    try {
      // 1. Get ruleset for the event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('league_id')
        .eq('event_id', eventId)
        .single()

      if (eventError || !eventData?.league_id) throw eventError || new Error('No league_id')

      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('ruleset_id')
        .eq('id', eventData.league_id)
        .single()

      if (leagueError || !leagueData?.ruleset_id) throw leagueError || new Error('No ruleset_id')

      const { data: ruleset, error: rulesetError } = await supabase
        .from('rulesets')
        .select('*')
        .eq('ruleset_id', leagueData.ruleset_id)
        .single()

      if (rulesetError) throw rulesetError

      // 2. Get pairings for current round
      const { data: pairingsData, error: pairingsError } = await supabase
        .from('pairings')
        .select('*')
        .eq('event_id', eventId)
        .eq('pairing_round', currentRound)

      if (pairingsError) throw pairingsError

      // 3. Calculate scores for each player
      for (const pairing of pairingsData || []) {
        const playerIds = [
          pairing.pairing_player1_id,
          pairing.pairing_player2_id,
          pairing.pairing_player3_id,
          pairing.pairing_player4_id
        ].filter((pid): pid is number => pid !== null)

        for (const playerId of playerIds) {
          // Get round result for this player
          const { data: resultData, error: resultError } = await supabase
            .from('round_results')
            .select('*')
            .eq('pairing_id', pairing.pairing_id)
            .eq('player_id', playerId)
            .single()

          if (resultError || !resultData) continue

          // Get all results for this pairing to calculate ties
          const { data: allResults, error: allResultsError } = await supabase
            .from('round_results')
            .select('player_id, position')
            .eq('pairing_id', pairing.pairing_id)

          if (allResultsError) continue

          // Count votes from other players at same table
          const { data: votesData, error: votesError } = await supabase
            .from('round_results')
            .select('brew_vote, play_vote_1, play_vote_2')
            .eq('pairing_id', pairing.pairing_id)
            .neq('player_id', playerId)

          if (votesError) continue

          const brewVote = votesData?.filter(v => v.brew_vote === playerId).length || 0
          const playVote1 = votesData?.filter(v => v.play_vote_1 === playerId).length || 0
          const playVote2 = votesData?.filter(v => v.play_vote_2 === playerId).length || 0
          const totalPlayCount = playVote1 + playVote2

          // Calculate score
          const position = resultData.position || 0
          const numberOfKills = resultData.number_of_kills || 0

          // Handle ties (same position)
          const samePositionPlayers = playerIds.filter((pid) => {
            const otherResult = allResults?.find(r => r.player_id === pid)
            return otherResult?.position === position && position !== 0
          })
          const sameRankCount = samePositionPlayers.length + 1

          // Calculate rank score
          const posValues = [
            0,
            ruleset?.rule_set_rank1 || 0,
            ruleset?.rule_set_rank2 || 0,
            ruleset?.rule_set_rank3 || 0,
            ruleset?.rule_set_rank4 || 0
          ]
          let rankSum = 0
          for (let i = 0; i < sameRankCount; i++) {
            const posIndex = Math.min(position + i, 4)
            rankSum += posValues[posIndex] || 0
          }
          const scoreRank = sameRankCount > 0 ? Math.floor(rankSum / sameRankCount) : 0

          // Calculate total score
          const scoreKill = numberOfKills * (ruleset?.rule_set_kill || 0)
          const scoreBrew = brewVote * (ruleset?.rule_set_brew || 0)
          const scorePlay = totalPlayCount * (ruleset?.rule_set_play || 0)
          const totalScore = scoreRank + scoreKill + scoreBrew + scorePlay

          // Get current standings
          const { data: currentStanding } = await supabase
            .from('standings')
            .select('standing_player_score, victories, brew_received, play_received')
            .eq('event_id', eventId)
            .eq('player_id', playerId)
            .single()

          const newScore = (currentStanding?.standing_player_score || 0) + totalScore
          const newVictories = (currentStanding?.victories || 0) + (position === 1 ? 1 : 0)
          const newBrew = (currentStanding?.brew_received || 0) + brewVote
          const newPlay = (currentStanding?.play_received || 0) + totalPlayCount

          // Update standings
          const { error: updateError } = await supabase
            .from('standings')
            .update({
              standing_player_score: newScore,
              victories: newVictories,
              brew_received: newBrew,
              play_received: newPlay
            })
            .eq('event_id', eventId)
            .eq('player_id', playerId)

          if (updateError) console.error('Update standings error:', updateError)
        }
      }

      // 4. Update standings ranks
      await fetchStandings(eventId)

      // 5. Increment round
      const { error: roundError } = await supabase
        .from('events')
        .update({ event_current_round: currentRound + 1 })
        .eq('event_id', eventId)

      if (roundError) throw roundError

      // 6. Check if event ended
      const { data: eventStatus } = await supabase
        .from('events')
        .select('event_current_round, event_round_number')
        .eq('event_id', eventId)
        .single()

      if (
        eventStatus
        && (eventStatus.event_current_round || 0) > (eventStatus.event_round_number || 0)
      ) {
        await supabase.from('events').update({ event_playing: false }).eq('event_id', eventId)
      } else {
        // Create pairings for next round
        await createPairings(eventId, currentRound + 1)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore nel prossimo round'
      console.error('[useEventStore] nextRound error:', err)
    } finally {
      loading.value = false
    }
  }

  async function turnBackRound(eventId: number, currentRound: number, leagueId: number) {
    loading.value = true
    error.value = null

    try {
      if (currentRound > 1) {
        // Decrement round
        await supabase
          .from('events')
          .update({ event_current_round: currentRound - 1 })
          .eq('event_id', eventId)

        // Delete pairings for current round
        await supabase
          .from('pairings')
          .delete()
          .eq('event_id', eventId)
          .eq('pairing_round', currentRound)
      } else {
        // Return to registration state
        await supabase
          .from('events')
          .update({
            event_current_round: 0,
            event_playing: false,
            event_registration_open: true
          })
          .eq('event_id', eventId)

        // Clear all data
        await supabase.from('standings').delete().eq('event_id', eventId)
        await supabase.from('pairings').delete().eq('event_id', eventId)
      }

      // Refresh events for this league
      await fetchEvents(leagueId, true)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore nel tornare indietro'
      console.error('[useEventStore] turnBackRound error:', err)
    } finally {
      loading.value = false
    }
  }

  function setCurrentEvent(event: Event | null) {
    currentEvent.value = event
  }

  return {
    events,
    currentEvent,
    standings,
    pairings,
    loading,
    error,
    getEventsByLeagueId,
    isEventEnded,
    fetchEvents,
    createEvent,
    deleteEvent,
    startEvent,
    fetchStandings,
    fetchLeagueStandings,
    fetchLeagueResults,
    fetchPairings,
    submitRoundResult,
    updateRoundResult,
    nextRound,
    turnBackRound,
    setCurrentEvent
  }
})
