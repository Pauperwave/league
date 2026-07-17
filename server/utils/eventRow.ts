// server\utils\eventRow.ts
// Shared scaffolding for the /api/events/:eventId/* endpoints: fetch the
// event's lifecycle columns with the uniform 404. Domain guards stay in each
// endpoint — they differ per intent (ADR-013).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/utils/types/database'

type EventLifecycleRow = Pick<
  Database['public']['Tables']['events']['Row'],
  'event_playing' | 'event_current_round' | 'event_round_number' | 'event_registration_open'
>

/**
 * Fetch the lifecycle columns of an event, throwing the uniform 404 when it
 * doesn't exist.
 */
export async function requireEventRow(
  supabase: SupabaseClient<Database>,
  eventId: number,
): Promise<EventLifecycleRow> {
  const { data, error } = await supabase
    .from('events')
    .select('event_playing, event_current_round, event_round_number, event_registration_open')
    .eq('event_id', eventId)
    .single()

  if (error || !data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Event not found'
    })
  }
  return data
}
