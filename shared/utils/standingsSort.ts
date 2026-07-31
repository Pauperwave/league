// shared\utils\standingsSort.ts
// Single tie-break rule for standings, shared between client composables
// (useLiveStandings, useLeagueStandingsQuery, TournamentRanking) and the BFF
// (roundScoring.ts's updateStandingsAndRanks, which persists standing_player_rank)
// so round/tournament/league views can never rank the same players differently.
// Order: total score, victories, kills, brew_received, play_received, then
// player_id as a stable last resort (deterministic — avoids rank flicker
// between otherwise-tied players on recompute).
//
// Victories and kills come before brew/play votes on purpose (ADR-047):
// they're objective, derived directly from what happened in-game (who won,
// how many players were eliminated) and hard to game. brew_received/
// play_received are assigned by the other players at the table — subjective,
// and in a league with the same recurring group there's a real risk of
// "courtesy" votes between friends. When the total score ties, the criteria
// hardest to influence socially should be exhausted before falling back to
// vote-based ones.
export interface StandingSortable {
  player_id: number
  standing_player_score: number | null
  victories: number | null
  // Unlike victories/brew/play (real, always-present nullable Standing
  // columns), kills is a computed extension field (StandingWithPlayer.kills?)
  // that's optional/`undefined` before it's been merged in — accept that too.
  kills?: number | null
  brew_received: number | null
  play_received: number | null
}

export function compareStandings(a: StandingSortable, b: StandingSortable): number {
  const scoreDiff = (b.standing_player_score ?? 0) - (a.standing_player_score ?? 0)
  if (scoreDiff !== 0) return scoreDiff

  const victoriesDiff = (b.victories ?? 0) - (a.victories ?? 0)
  if (victoriesDiff !== 0) return victoriesDiff

  const killsDiff = (b.kills ?? 0) - (a.kills ?? 0)
  if (killsDiff !== 0) return killsDiff

  const brewDiff = (b.brew_received ?? 0) - (a.brew_received ?? 0)
  if (brewDiff !== 0) return brewDiff

  const playDiff = (b.play_received ?? 0) - (a.play_received ?? 0)
  if (playDiff !== 0) return playDiff

  return a.player_id - b.player_id
}
