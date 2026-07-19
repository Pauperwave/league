// test\e2e\helpers\cleanup.ts
// Guaranteed teardown for disposable E2E entities, called from test.afterEach/
// afterAll. Never throws — a cleanup failure must not mask the actual test's
// pass/fail, but must be loud in the test output so it's never silently missed
// (this suite runs against the real production DB, BACKLOG #1).
import type { APIRequestContext } from '@playwright/test'

async function safeDelete(request: APIRequestContext, path: string, label: string) {
  try {
    const res = await request.post(path)
    if (!res.ok() && res.status() !== 404) {
      console.error(`[e2e cleanup] ${label} delete failed: ${res.status()} ${await res.text()}`)
    }
  } catch (err) {
    console.error(`[e2e cleanup] ${label} delete threw:`, err)
  }
}

/**
 * Players have no delete endpoint at all — deliberately, see api.md (players
 * are referenced throughout history/results). Cleanup goes straight to
 * Supabase with the service-role key, same as this repo's manual E2E cleanup
 * earlier in the session — this is test-only teardown, not a pattern the app
 * itself should ever use.
 */
async function deletePlayerDirect(playerId: number) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    console.error('[e2e cleanup] player cleanup skipped: SUPABASE_URL/SUPABASE_SECRET_KEY not set')
    return
  }
  try {
    const res = await fetch(`${url}/rest/v1/players?player_id=eq.${playerId}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) {
      console.error(`[e2e cleanup] player ${playerId} delete failed: ${res.status} ${await res.text()}`)
    }
  } catch (err) {
    console.error(`[e2e cleanup] player ${playerId} delete threw:`, err)
  }
}

export const cleanup = {
  league: (request: APIRequestContext, id: number) => safeDelete(request, `/api/leagues/${id}/delete`, `league ${id}`),
  event: (request: APIRequestContext, id: number) => safeDelete(request, `/api/events/${id}/delete`, `event ${id}`),
  ruleset: (request: APIRequestContext, id: number) => safeDelete(request, `/api/rulesets/${id}/delete`, `ruleset ${id}`),
  deck: (request: APIRequestContext, id: number) => safeDelete(request, `/api/decks/${id}/delete`, `deck ${id}`),
  player: (_request: APIRequestContext, id: number) => deletePlayerDirect(id),
}
