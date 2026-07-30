// shared\utils\standingsSort.ts
// Single tie-break rule for standings, shared between client composables
// (useLiveStandings, useLeagueStandingsQuery, TournamentRanking) and the BFF
// (roundScoring.ts's updateStandingsAndRanks, which persists standing_player_rank)
// so round/tournament/league views can never rank the same players differently.
// Order: total score, victories, brew_received, play_received, then player_id
// as a stable last resort (deterministic — avoids rank flicker between
// otherwise-tied players on recompute).
export interface StandingSortable {
  player_id: number
  standing_player_score: number | null
  victories: number | null
  brew_received: number | null
  play_received: number | null
}

export function compareStandings(a: StandingSortable, b: StandingSortable): number {
  const scoreDiff = (b.standing_player_score ?? 0) - (a.standing_player_score ?? 0)
  if (scoreDiff !== 0) return scoreDiff

  const victoriesDiff = (b.victories ?? 0) - (a.victories ?? 0)
  if (victoriesDiff !== 0) return victoriesDiff

  const brewDiff = (b.brew_received ?? 0) - (a.brew_received ?? 0)
  if (brewDiff !== 0) return brewDiff

  const playDiff = (b.play_received ?? 0) - (a.play_received ?? 0)
  if (playDiff !== 0) return playDiff

  return a.player_id - b.player_id
}
