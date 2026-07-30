// app\composables\tournament\useTournamentMutations.ts
// Pinia Colada mutations for tournament CRUD (ADR-015): $fetch to the BFF
// endpoints (ADR-013), then invalidate the events list (+ league standings,
// since deleting a tournament changes the summed aggregate) so the caches
// refetch server truth. Lifecycle transitions (start/nextRound/turnBack) and
// round-result writes stay in useTournamentStore — they're multi-step
// orchestration, not single-entity CRUD, and already refresh their own set
// of query keys via useTournamentPage's refreshAfterLifecycle().
import type { Tournament, TournamentInsert } from '#shared/utils/types'

export function useTournamentMutations() {
  const queryCache = useQueryCache()
  const invalidate = () => {
    queryCache.invalidateQueries({ key: EVENTS_KEY })
    queryCache.invalidateQueries({ key: LEAGUE_STANDINGS_KEY })
  }

  const createTournament = useMutation({
    mutation: (event: TournamentInsert) =>
      $fetch<{ event: Tournament }>('/api/tournaments/create', { method: 'POST', body: event }),
    onSettled: invalidate,
  })

  // Template-literal URLs are cast to string: matching them against Nitro's
  // typed route union blows the TS depth limit in the IDE ("Excessive stack
  // depth") as the route count grows — the explicit generic keeps the
  // response typed instead.
  const updateTournament = useMutation({
    mutation: ({ id, data }: { id: number, data: Partial<Tournament> }) =>
      $fetch<{ event: Tournament }>(`/api/tournaments/${id}/update` as string, { method: 'POST', body: data }),
    onSettled: invalidate,
  })

  const deleteTournament = useMutation({
    mutation: (id: number) =>
      $fetch<{ deleted: boolean }>(`/api/tournaments/${id}/delete` as string, { method: 'POST' }),
    onSettled: invalidate,
  })

  return { createTournament, updateTournament, deleteTournament }
}
