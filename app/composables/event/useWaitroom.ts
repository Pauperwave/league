// app\composables\event\useWaitroom.ts
// Pinia Colada query + mutations for an event's waiting list (ADR-015).
// Reads stay client → Supabase; register/unregister go through the BFF
// endpoints (ADR-013 wave 1), which own the domain rules (registration
// open, duplicates) — invalidation refetches server truth afterwards.
// Successor of the waitroom state that lived in the players store.

/** Query-key prefix for per-event waitroom lists — invalidated by useWaitroomMutations. */
export const WAITROOM_KEY = ['waitroom']

export function useWaitroom(eventId: number) {
  const supabase = useSupabaseClient()

  const { data, isLoading, error, refresh } = useQuery({
    key: [...WAITROOM_KEY, eventId],
    query: async (): Promise<{ player_id: number, inserted_at: string | null }[]> => {
      const { data: rows, error: waitroomError } = await supabase
        .from('waitroom')
        .select('player_id, inserted_at')
        .eq('event_id', eventId)
        .order('inserted_at', { ascending: true })

      if (waitroomError) throw waitroomError
      return rows ?? []
    },
  })

  /** Player ids in the waitroom, in registration order */
  const waitingPlayers = computed(() => (data.value ?? []).map(w => w.player_id))
  /** Map of playerId -> insertedAt timestamp */
  const waitroomEntries = computed(() =>
    new Map((data.value ?? []).map(w => [w.player_id, w.inserted_at ?? '']))
  )

  return { waitingPlayers, waitroomEntries, isLoading, error, refresh }
}

export function useWaitroomMutations(eventId: number) {
  const queryCache = useQueryCache()
  const invalidate = () => queryCache.invalidateQueries({ key: [...WAITROOM_KEY, eventId] })

  // Template-literal URLs are cast to string — see usePlayerMutations for why.
  const registerPlayers = useMutation({
    mutation: (playerIds: number[]) =>
      $fetch<{ registered: { player_id: number, inserted_at: string | null }[], alreadyRegistered: number[] }>(
        `/api/events/${eventId}/register-player` as string,
        { method: 'POST', body: { playerIds } },
      ),
    onSettled: invalidate,
  })

  const unregisterPlayers = useMutation({
    mutation: (playerIds: number[]) =>
      $fetch<{ removed: number[] }>(
        `/api/events/${eventId}/unregister-player` as string,
        { method: 'POST', body: { playerIds } },
      ),
    onSettled: invalidate,
  })

  return { registerPlayers, unregisterPlayers }
}
