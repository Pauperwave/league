// app\utils\error.ts

/**
 * Extracts a human-readable error message from an unknown thrown value.
 * @param err - The caught error (unknown type)
 * @param fallback - Fallback string if no message can be extracted
 */
export function toErrorMessage(err: unknown, fallback = 'Unknown error'): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return fallback
}

/**
 * True when a caught $fetch error is a 409 Conflict — the BFF's answer for
 * domain "in use" guards (ruleset used by a league, deck played in an event).
 */
export function isConflictError(err: unknown): boolean {
  return typeof err === 'object' && err !== null
    && 'statusCode' in err && (err as { statusCode?: number }).statusCode === 409
}
