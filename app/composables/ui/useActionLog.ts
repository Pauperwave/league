// app\composables\ui\useActionLog.ts
import type { Ref } from 'vue'

const ACTION_LOG_KEY = 'action-log-entries'
const ACTION_LOG_MAX_ENTRIES = 250
// Not a real cache — getCached/setCached's TTL is repurposed here as an
// effectively-never-expire threshold (~10 years) since this log has no
// time-based expiry, only the size cap above.
const ACTION_LOG_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000

export interface ActionLogEntry {
  id: string
  button: string
  timestamp: string
  context?: Record<string, unknown>
}

// Module-scope singleton: every call to useActionLog() — and
// useButtonLogging.logClick() calls this on every single click app-wide —
// must share the exact same reactive array, or two independent instances
// (each seeded from localStorage at creation, writing back independently)
// can race and silently undo each other's writes. That's what caused
// "Svuota log" to appear to do nothing: the click that logs the clear
// button itself created a second, stale instance that rewrote localStorage
// right after the clear. Safe across SSR: recordEntry/clearLog only ever
// run from a real browser click event, never during server rendering, so
// this module-level ref never accumulates real entries on the server.
let sharedEntries: Ref<ActionLogEntry[]> | null = null

function getSharedEntries(): Ref<ActionLogEntry[]> {
  if (!sharedEntries) {
    sharedEntries = ref(getCached<ActionLogEntry[]>(ACTION_LOG_KEY, ACTION_LOG_TTL_MS) ?? [])
  }
  return sharedEntries
}

/**
 * Persisted, capped ring buffer of button-click actions, fed by
 * useButtonLogging (app/composables/ui/useButtonLogging.ts) so developer
 * mode's action log panel can show them without opening devtools.
 */
export function useActionLog() {
  const entries = getSharedEntries()

  function recordEntry(entry: Omit<ActionLogEntry, 'id'>) {
    const next = [...entries.value, { id: crypto.randomUUID(), ...entry }]
    const overflow = next.length - ACTION_LOG_MAX_ENTRIES
    entries.value = overflow > 0 ? next.slice(overflow) : next
    setCached(ACTION_LOG_KEY, entries.value)
  }

  function clearLog() {
    entries.value = []
    setCached(ACTION_LOG_KEY, entries.value)
  }

  return { entries, recordEntry, clearLog }
}
