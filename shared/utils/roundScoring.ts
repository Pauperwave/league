// shared\utils\roundScoring.ts
// Round-scoring and pairing-row helpers shared between the client store
// (app/stores/events.ts — startEvent's round-1 pairings) and the BFF endpoints
// (server/api/events/[eventId]/* — ADR-013). Everything is parameterized on a
// SupabaseClient or pure, so it runs identically on both sides.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types/database'
import type { Pairing, PairingInsert, RoundResult, Ruleset } from './types'

export interface StandingAccumulator {
  player_id: number
  standing_player_score: number
  victories: number
  brew_received: number
  play_received: number
}

/** Resolve event → league → ruleset and build position-value array */
export async function resolveEventRuleset(supabase: SupabaseClient<Database>, eventId: number) {
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
export async function fetchRoundData(supabase: SupabaseClient<Database>, eventId: number, currentRound: number) {
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
export function calculateRoundScores(
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
export async function updateStandingsAndRanks(supabase: SupabaseClient<Database>, eventId: number, standingsMap: Map<number, StandingAccumulator>) {
  // .select() makes the update return the affected rows: an update silently
  // filtered out by RLS (no UPDATE policy for the anon role) reports NO error
  // and 0 rows — without this check, scores vanish and standings stay 0.
  const scoreUpdates = await Promise.all(
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
        .eq('player_id', s.player_id)
        .select('player_id'),
    ),
  )

  for (const { error } of scoreUpdates) {
    if (error) throw error
  }
  const affected = scoreUpdates.reduce((count, u) => count + (u.data?.length ?? 0), 0)
  if (affected < standingsMap.size) {
    throw new Error(
      `standings score update affected ${affected}/${standingsMap.size} rows — `
      + `likely a missing UPDATE RLS policy for the anon role on 'standings' `
      + `(see supabase/migrations/*_add_standings_write_policies.sql)`,
    )
  }

  const ranked = Array.from(standingsMap.values()).sort(
    (a, b) => b.standing_player_score - a.standing_player_score,
  )

  const rankUpdates = await Promise.all(
    ranked.map((s, index) =>
      supabase
        .from('standings')
        .update({ standing_player_rank: index + 1 })
        .eq('event_id', eventId)
        .eq('player_id', s.player_id),
    ),
  )

  for (const { error } of rankUpdates) {
    if (error) throw error
  }
}

/** Build tables by slicing a confirmed player order into 4s then 3s. */
export function buildRoundOneTables(playerOrder: number[]): number[][] {
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

/** Map table player-id groups to pairing insert rows. */
export function buildPairingRows(eventId: number, round: number, tables: number[][]): PairingInsert[] {
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
