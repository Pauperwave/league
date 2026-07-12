// app/composables/supabase/useStatsQueryBuilder.ts

/**
 * Apply commander_2 filter to a Supabase query.
 * Handles the NULL vs value distinction correctly for Postgres.
 *
 * Usage:
 *   const query = applyCommander2Filter(
 *     supabase.from('deck_stats').select('*').eq('commander_1', name),
 *     commander2Name
 *   )
 */
export function applyCommander2Filter<T extends { eq(col: string, val: unknown): T; is(col: string, val: null): T }>(
  query: T,
  commander2Name: string | null | undefined
): T {
  if (commander2Name) {
    return query.eq('commander_2', commander2Name)
  }
  return query.is('commander_2', null)
}
