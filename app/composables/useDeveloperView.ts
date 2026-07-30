// app\composables\useDeveloperView.ts

const DEVELOPER_VIEW_KEY = 'developer-view-enabled'
const DEVELOPER_VIEW_OVERLAY_KEY = 'developer-view-overlay-enabled'

/**
 * Global toggle for dev-only test-data helpers (quick-fill buttons, etc.)
 * scattered across the app. Off by default — these are testing shortcuts,
 * not something an organizer running a real tournament should stumble into.
 * Persisted via `useLocalStorage` so it survives reloads while testing.
 *
 * `isOverlayEnabled` is a separate, independently-persisted switch (off by
 * default, same reasoning as isDeveloperView) for just the visual debug
 * overlay (outlines + heading badges + missing-alt/label highlighting, see
 * useDeveloperViewOverlay.ts/main.css) — lets developer mode stay on for
 * quick-fill buttons/the action log without the outline overlay being
 * visually distracting unless explicitly turned on.
 */
export function useDeveloperView() {
  const isDeveloperView = useLocalStorage(DEVELOPER_VIEW_KEY, false)
  const isOverlayEnabled = useLocalStorage(DEVELOPER_VIEW_OVERLAY_KEY, false)
  return { isDeveloperView, isOverlayEnabled }
}
