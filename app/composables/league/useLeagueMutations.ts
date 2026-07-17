// app\composables\league\useLeagueMutations.ts
// Pinia Colada mutations for league CRUD (ADR-015): $fetch to the BFF
// endpoints (ADR-013), then invalidate the leagues list so the cache
// refetches server truth. Toasts stay at the call sites — they own the
// Italian copy and the surrounding UI state.
import type { League } from '#shared/utils/types'

/** The form payload emitted by LeagueFormModal (create and update alike). */
export interface LeagueFormPayload {
  name: string
  startsAt: string | null
  endsAt: string | null
  rulesetId: number | null
}

export function useLeagueMutations() {
  const queryCache = useQueryCache()
  const invalidate = () => queryCache.invalidateQueries({ key: LEAGUES_KEY })

  const createLeague = useMutation({
    mutation: (payload: LeagueFormPayload) =>
      $fetch('/api/leagues/create', { method: 'POST', body: payload }),
    onSettled: invalidate,
  })

  // Template-literal URLs are cast to string: matching them against Nitro's
  // typed route union blows the TS depth limit in the IDE ("Excessive stack
  // depth") as the route count grows — the explicit generic keeps the
  // response typed instead.
  const updateLeague = useMutation({
    mutation: ({ id, data }: { id: number, data: LeagueFormPayload }) =>
      $fetch<{ league: League }>(`/api/leagues/${id}/update` as string, { method: 'POST', body: data }),
    onSettled: invalidate,
  })

  const deleteLeague = useMutation({
    mutation: (id: number) =>
      $fetch<{ deleted: boolean }>(`/api/leagues/${id}/delete` as string, { method: 'POST' }),
    onSettled: invalidate,
  })

  return { createLeague, updateLeague, deleteLeague }
}
