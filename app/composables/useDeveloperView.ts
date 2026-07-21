// app\composables\useDeveloperView.ts

const DEVELOPER_VIEW_KEY = 'developer-view-enabled'

/**
 * Global toggle for dev-only test-data helpers (quick-fill buttons, etc.)
 * scattered across the app. Off by default — these are testing shortcuts,
 * not something an organizer running a real event should stumble into.
 * Persisted via `useLocalStorage` so it survives reloads while testing.
 */
export function useDeveloperView() {
  const isDeveloperView = useLocalStorage(DEVELOPER_VIEW_KEY, false)
  return { isDeveloperView }
}
