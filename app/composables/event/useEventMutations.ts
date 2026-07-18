// app\composables\event\useEventMutations.ts
// Pinia Colada mutations for event CRUD (ADR-015): $fetch to the BFF
// endpoints (ADR-013), then invalidate the events list (+ league standings,
// since deleting an event changes the summed aggregate) so the caches
// refetch server truth. Lifecycle transitions (start/nextRound/turnBack) and
// round-result writes stay in useEventStore — they're multi-step
// orchestration, not single-entity CRUD, and already refresh their own set
// of query keys via useEventPage's refreshAfterLifecycle().
import type { Event, EventInsert } from '#shared/utils/types'

export function useEventMutations() {
  const queryCache = useQueryCache()
  const invalidate = () => {
    queryCache.invalidateQueries({ key: EVENTS_KEY })
    queryCache.invalidateQueries({ key: LEAGUE_STANDINGS_KEY })
  }

  const createEvent = useMutation({
    mutation: (event: EventInsert) =>
      $fetch<{ event: Event }>('/api/events/create', { method: 'POST', body: event }),
    onSettled: invalidate,
  })

  // Template-literal URLs are cast to string: matching them against Nitro's
  // typed route union blows the TS depth limit in the IDE ("Excessive stack
  // depth") as the route count grows — the explicit generic keeps the
  // response typed instead.
  const updateEvent = useMutation({
    mutation: ({ id, data }: { id: number, data: Partial<Event> }) =>
      $fetch<{ event: Event }>(`/api/events/${id}/update` as string, { method: 'POST', body: data }),
    onSettled: invalidate,
  })

  const deleteEvent = useMutation({
    mutation: (id: number) =>
      $fetch<{ deleted: boolean }>(`/api/events/${id}/delete` as string, { method: 'POST' }),
    onSettled: invalidate,
  })

  return { createEvent, updateEvent, deleteEvent }
}
