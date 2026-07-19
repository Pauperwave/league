// test\e2e\turn-back-round.e2e.spec.ts
// API-only spec (no `page`, just Playwright's `request` fixture — same
// authenticated storageState as the browser specs) reproducing BACKLOG #11:
// turn-back-round used to 500 whenever the round being rolled back already
// had round_results (a regression from the 2026-07-19 RESTRICT-cascade
// migration — round_results.pairing_id -> pairings.pairing_id can no longer
// be deleted out from under existing round_results). Every entity here is
// disposable (tagged players/league/event), deleted in afterEach regardless
// of outcome — never assert against or mutate pre-existing data.
import { expect, test } from '@playwright/test'
import { cleanup } from './helpers/cleanup'
import { testTag } from './helpers/testTag'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY

function supabaseHeaders() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error('SUPABASE_URL/SUPABASE_SECRET_KEY must be set in the environment running Playwright (same as .env).')
  }
  return { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` }
}

async function fetchPairingIds(eventId: number, round: number): Promise<number[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pairings?event_id=eq.${eventId}&pairing_round=eq.${round}&select=pairing_id`, {
    headers: supabaseHeaders(),
  })
  const rows = await res.json() as { pairing_id: number }[]
  return rows.map(r => r.pairing_id)
}

async function countRoundResults(pairingIds: number[]): Promise<number> {
  if (pairingIds.length === 0) return 0
  const filter = pairingIds.map(id => `pairing_id.eq.${id}`).join(',')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/round_results?or=(${filter})&select=id`, {
    headers: supabaseHeaders(),
  })
  const rows = await res.json() as { id: number }[]
  return rows.length
}

let playerIds: number[] = []
let leagueId: number | undefined
let eventId: number | undefined

test.afterEach(async ({ request }) => {
  // Unregister first: turn-back-round-to-registration restores the waitroom,
  // and the event-delete guard 409s on any remaining waitroom/pairings/
  // standings rows (see server/api/events/[eventId]/delete.post.ts).
  if (eventId !== undefined && playerIds.length > 0) {
    await request.post(`/api/events/${eventId}/unregister-player`, { data: { playerIds } }).catch(() => {})
  }
  if (eventId !== undefined) {
    await cleanup.event(request, eventId)
    eventId = undefined
  }
  if (leagueId !== undefined) {
    await cleanup.league(request, leagueId)
    leagueId = undefined
  }
  for (const id of playerIds) {
    await cleanup.player(request, id)
  }
  playerIds = []
})

test('turn-back-round succeeds and clears round_results when scores were already submitted', async ({ request }) => {
  // 3 disposable players (a valid table size — start.post.ts rejects exactly 5).
  for (let i = 0; i < 3; i++) {
    const res = await request.post('/api/players/create', {
      data: { player_name: testTag('Player'), player_surname: `E2E${i}` },
    })
    expect(res.ok()).toBe(true)
    const { player } = await res.json() as { player: { player_id: number } }
    playerIds.push(player.player_id)
  }

  const leagueRes = await request.post('/api/leagues/create', {
    data: { name: testTag('League'), startsAt: null, endsAt: null, rulesetId: null },
  })
  expect(leagueRes.ok()).toBe(true)
  const { league } = await leagueRes.json() as { league: { id: number } }
  leagueId = league.id

  const eventRes = await request.post('/api/events/create', {
    data: {
      event_name: testTag('Event'),
      league_id: leagueId,
      event_round_number: 1,
      event_round_duration: 30,
    },
  })
  expect(eventRes.ok()).toBe(true)
  const { event } = await eventRes.json() as { event: { event_id: number } }
  eventId = event.event_id

  const registerRes = await request.post(`/api/events/${eventId}/register-player`, { data: { playerIds } })
  expect(registerRes.ok()).toBe(true)

  const startRes = await request.post(`/api/events/${eventId}/start`, { data: { playerOrder: playerIds } })
  if (!startRes.ok()) {
    throw new Error(`start failed: ${startRes.status()} ${await startRes.text()}`)
  }

  const pairingIds = await fetchPairingIds(eventId, 1)
  expect(pairingIds).toHaveLength(1)
  const [pairingId] = pairingIds

  const rankingsRes = await request.post(`/api/pairings/${pairingId}/rankings`, {
    data: { rankings: playerIds.map((playerId, i) => ({ playerId, position: i + 1 })) },
  })
  if (!rankingsRes.ok()) {
    throw new Error(`rankings submit failed: ${rankingsRes.status()} ${await rankingsRes.text()}`)
  }

  expect(await countRoundResults(pairingIds)).toBe(playerIds.length)

  // This is the actual bug: used to 500 (FK RESTRICT violation on
  // round_results.pairing_id) whenever the round being rolled back had
  // already-submitted scores — exactly the realistic case for turning a
  // round back at all.
  const turnBackRes = await request.post(`/api/events/${eventId}/turn-back-round`, { data: { currentRound: 1 } })
  if (!turnBackRes.ok()) {
    throw new Error(`turn-back-round failed: ${turnBackRes.status()} ${await turnBackRes.text()}`)
  }

  // The rolled-back round's results must be gone, not left as orphaned rows.
  expect(await countRoundResults(pairingIds)).toBe(0)
})
