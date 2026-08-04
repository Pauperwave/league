// app\utils\tournamentStatus.ts
/** `tournament_current_round` is bumped one past `tournament_round_number` as
 *  the internal "ended" sentinel (advance-round.post.ts) — there's no
 *  separate status column. Shared so this comparison isn't re-derived per
 *  call site (TournamentsTable.vue, useTournamentStore, the last-tournament
 *  waiting-list import). */
export function isTournamentRowEnded(
  tournament: { tournament_current_round: number | null, tournament_round_number: number | null }
): boolean {
  return (tournament.tournament_current_round ?? 0) > (tournament.tournament_round_number ?? 0)
}
