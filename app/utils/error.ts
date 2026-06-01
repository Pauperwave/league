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
