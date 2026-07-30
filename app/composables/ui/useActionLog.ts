// app\composables\ui\useActionLog.ts

const ACTION_LOG_KEY = 'action-log-entries'
const ACTION_LOG_MAX_ENTRIES = 250

export interface ActionLogEntry {
  id: string
  button: string
  timestamp: string
  context?: Record<string, unknown>
}

/**
 * Persisted, capped ring buffer of button-click actions, fed by
 * useButtonLogging (app/composables/ui/useButtonLogging.ts) so developer
 * mode's action log panel can show them without opening devtools.
 * Persisted via `useLocalStorage` the same way `useDeveloperView` is, so
 * writer and reader share the same ref regardless of where they're called.
 */
export function useActionLog() {
  const entries = useLocalStorage<ActionLogEntry[]>(ACTION_LOG_KEY, [])

  function recordEntry(entry: Omit<ActionLogEntry, 'id'>) {
    entries.value.push({ id: crypto.randomUUID(), ...entry })

    const overflow = entries.value.length - ACTION_LOG_MAX_ENTRIES
    if (overflow > 0) {
      entries.value.splice(0, overflow)
    }
  }

  function clearLog() {
    entries.value = []
  }

  return { entries, recordEntry, clearLog }
}
