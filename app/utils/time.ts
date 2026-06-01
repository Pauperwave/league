// app\utils\time.ts

/**
 * Formats a duration in seconds to a compact H:MM:SS or MM:SS string.
 * Hours are shown only when >= 1 hour.
 * Timezone-safe — uses pure arithmetic, no Date objects.
 *
 * @param totalSeconds - Duration in seconds (must be >= 0)
 * @returns Formatted string, e.g. "5:03" or "1:05:09"
 */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60

  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')

  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
