export interface Tournament {
  tournament_id: number
  event_id: number
  tournament_name: string
  tournament_date?: string
  status?: string
}

export function useTournaments(eventId?: number) {
  const key = eventId ? `tournaments-${eventId}` : 'tournaments-all'

  // @ts-expect-error - tournaments table not in database yet
  return useAsyncData<Tournament[]>(key, async () => {
    const client = useSupabaseClient()
    // @ts-expect-error - tournaments table not in database yet
    let query = client.from('tournaments').select('*').order('tournament_id')

    if (eventId) {
      // @ts-expect-error - tournaments table not in database yet
      query = query.eq('event_id', eventId)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  })
}
