// shared\utils\roundScoring.ts
// Round-scoring and pairing-row helpers shared between the client store
// (app/stores/tournaments.ts — startTournament's round-1 pairings) and the BFF endpoints
// (server/api/tournaments/[tournamentId]/* — ADR-013). Everything is parameterized on a
// SupabaseClient or pure, so it runs identically on both sides.
import type { SupabaseClient } from '@supabase/supabase-js'
import { compareStandings } from './standingsSort'
import type { Database } from './types/database'
import type { Pairing, PairingInsert, RoundResult, Ruleset } from './types'

export interface StandingAccumulator {
  player_id: number
  standing_player_score: number
  victories: number
  kills: number
  brew_received: number
  play_received: number
}

/** Resolve tournament → league → ruleset and build position-value array */
export async function resolveTournamentRuleset(
  supabase: SupabaseClient<Database>, tournamentId: number
) {
  const { data: tournamentData, error: tournamentError } = await supabase
    .from('tournaments')
    .select('league_id, tournament_round_number')
    .eq('tournament_id', tournamentId)
    .single()

  if (tournamentError || !tournamentData?.league_id) throw tournamentError ?? new Error('No league_id')

  const { data: leagueData, error: leagueError } = await supabase
    .from('leagues')
    .select('ruleset_id')
    .eq('id', tournamentData.league_id)
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

  return { ruleset, posValues, tournamentRoundNumber: tournamentData.tournament_round_number }
}

/**
 * Fetch every pairing/result through `currentRound` (not just the round being
 * closed) and a zeroed accumulator per player, so the caller recomputes the
 * full standings from scratch instead of adding onto whatever is persisted.
 *
 * This is the fix for BACKLOG #11/#12: the previous version seeded the
 * accumulator from the *already-persisted* standings row and only fetched the
 * single round being closed, which double-counted a round's score if it was
 * ever turned back and re-advanced (the persisted value already included it).
 * Recomputing cumulatively from `round_results` every time is idempotent —
 * calling this twice for the same round set always yields the same totals —
 * since `updateStandingsAndRanks` writes the result as an absolute value, not
 * an increment.
 */
export async function fetchRoundData(
  supabase: SupabaseClient<Database>, tournamentId: number, currentRound: number
) {
  const [
    { data: pairingsData, error: pairingsError },
    { data: currentStandings, error: currentStandingsError }
  ] = await Promise.all([
    supabase.from('pairings').select('*').eq('tournament_id', tournamentId).lte('pairing_round', currentRound),
    supabase.from('standings').select('player_id').eq('tournament_id', tournamentId),
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
      standing_player_score: 0,
      victories: 0,
      kills: 0,
      brew_received: 0,
      play_received: 0,
    }])
  )

  return { pairings: pairingsData ?? [], results: allResults ?? [], standingsMap }
}

export interface PlayerTableScore {
  playerId: number
  /** Raw dense position as stored (0 = no result submitted yet). */
  position: number
  scoreRank: number
  numberOfKills: number
  killScore: number
  brewVote: number
  brewScore: number
  totalPlayCount: number
  playScore: number
  totalScore: number
}

/**
 * Score a single player's result at one table. Shared by calculateRoundScores
 * (bulk standings recompute) and TableScoresModal ("Punteggi Tavolo" — the
 * read-only per-table breakdown) so the two can never drift, which is exactly
 * what happened before this was extracted: the modal had its own hardcoded
 * [3,2,1,0] placement table and unweighted kill/vote counts instead of the
 * ruleset's actual point values.
 */
export function calculatePlayerTableScore(
  playerId: number,
  tableResults: RoundResult[],
  posValues: number[],
  ruleset: Ruleset | null,
): PlayerTableScore | null {
  const myResult = tableResults.find(r => r.player_id === playerId)
  if (!myResult) return null

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

  // Positions are stored "dense" (TableScoreGrid/useRankingGrid enforces
  // a gapless 1,1,2,3 — never a skip-rank 1,1,3,4: "ranks used must form
  // a consecutive sequence starting from 1"). Standard tournament
  // scoring needs skip-rank spacing though: after a 2-way tie for 1st,
  // the next player is effectively 3rd, since two point-slots (1st and
  // 2nd) were already consumed by the tie. Re-derive that effective
  // starting slot from how many players rank strictly above this one
  // instead of trusting the raw dense position — this is what makes
  // 1,1,2,3 score identically to its skip-rank equivalent 1,1,3,4 (and
  // 1,1,1,2 to 1,1,1,4, 1,2,2,3 to 1,2,2,4).
  const effectivePosition = position !== 0
    ? 1 + tableResults.filter(r =>
      r.position !== null && r.position !== 0 && r.position < position
    ).length
    : 0

  let rankSum = 0
  for (let i = 0; i < samePositionCount; i++) {
    rankSum += posValues[Math.min(effectivePosition + i, 4)] ?? 0
  }
  const scoreRank = Math.floor(rankSum / samePositionCount)

  const killScore = numberOfKills * (ruleset?.rule_set_kill ?? 0)
  const brewScore = brewVote * (ruleset?.rule_set_brew ?? 0)
  const playScore = totalPlayCount * (ruleset?.rule_set_play ?? 0)

  return {
    playerId,
    position,
    scoreRank,
    numberOfKills,
    killScore,
    brewVote,
    brewScore,
    totalPlayCount,
    playScore,
    totalScore: scoreRank + killScore + brewScore + playScore,
  }
}

/**
 * "Patta" (draw, see handleDrawSubmit/PairingTableActions.vue): zero kills
 * for everyone and everyone tied for 1st. Nobody actually *won* the table in
 * this case — the winner is whoever's still alive at the end of the round,
 * and a draw means nobody was — so unlike a genuine 2+-way tie for 1st
 * (which still credits every tied player a victory), a draw credits nobody.
 */
export function isDrawTable(tableResults: RoundResult[]): boolean {
  return tableResults.length > 0
    && tableResults.every(r => r.position === 1)
    && tableResults.every(r => (r.number_of_kills ?? 0) === 0)
}

export interface PlayerPointBreakdown {
  kills: number
  placementPoints: number
  killPoints: number
  brewPoints: number
  playPoints: number
}

/**
 * Per-player kills/placement/brew/play recompute for a set of pairings (with
 * nested round_results) under one ruleset — the read-side counterpart to
 * `calculateRoundScores` (which writes). Shared by `useEventStandingsQuery`
 * (single tournament) and `useLeagueStandingsQuery` (summed across a
 * league's tournaments, one call per tournament since each could in
 * principle carry a different ruleset) so the two views can't drift.
 */
export function aggregatePointBreakdowns(
  pairings: { pairing_id: number; round_results?: RoundResult[] | null }[],
  posValues: number[],
  ruleset: Ruleset | null,
): Map<number, PlayerPointBreakdown> {
  const breakdowns = new Map<number, PlayerPointBreakdown>()

  const ensure = (playerId: number): PlayerPointBreakdown => {
    let entry = breakdowns.get(playerId)
    if (!entry) {
      entry = { kills: 0, placementPoints: 0, killPoints: 0, brewPoints: 0, playPoints: 0 }
      breakdowns.set(playerId, entry)
    }
    return entry
  }

  for (const pairing of pairings) {
    const tableResults = pairing.round_results ?? []

    for (const result of tableResults) {
      const scored = calculatePlayerTableScore(result.player_id, tableResults, posValues, ruleset)
      if (!scored) continue

      const entry = ensure(result.player_id)
      entry.kills += scored.numberOfKills
      entry.placementPoints += scored.scoreRank
      entry.killPoints += scored.killScore
      entry.brewPoints += scored.brewScore
      entry.playPoints += scored.playScore
    }
  }

  return breakdowns
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
    const isDraw = isDrawTable(tableResults)

    for (const playerId of playerIds) {
      const scored = calculatePlayerTableScore(playerId, tableResults, posValues, ruleset)
      if (!scored) continue

      const acc = standingsMap.get(playerId)
      if (acc) {
        acc.standing_player_score += scored.totalScore
        acc.victories += (scored.position === 1 && !isDraw) ? 1 : 0
        acc.kills += scored.numberOfKills
        acc.brew_received += scored.brewVote
        acc.play_received += scored.totalPlayCount
      }
    }
  }
}

/** Batch-update standings scores, then update ranks */
export async function updateStandingsAndRanks(
  supabase: SupabaseClient<Database>,
  tournamentId: number,
  standingsMap: Map<number, StandingAccumulator>
) {
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
        .eq('tournament_id', tournamentId)
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

  const ranked = Array.from(standingsMap.values()).sort(compareStandings)

  const rankUpdates = await Promise.all(
    ranked.map((s, index) =>
      supabase
        .from('standings')
        .update({ standing_player_rank: index + 1 })
        .eq('tournament_id', tournamentId)
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
export function buildPairingRows(
  tournamentId: number, round: number, tables: number[][], pairingDatetime: string | null = null
): PairingInsert[] {
  return tables
    .filter(table => table.length >= 3)
    .map(table => ({
      tournament_id: tournamentId,
      pairing_round: round,
      pairing_is_full: table.length === 4,
      pairing_player1_id: table[0] ?? null,
      pairing_player2_id: table[1] ?? null,
      pairing_player3_id: table[2] ?? null,
      pairing_player4_id: table[3] ?? null,
      pairing_datetime: pairingDatetime,
    }))
}
