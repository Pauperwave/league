// test\e2e\event-lifecycle.e2e.spec.ts
// API-only spec (no `page`, just Playwright's `request` fixture — same
// pattern as turn-back-round.e2e.spec.ts) covering the full tournament lifecycle
// end to end (BACKLOG #1's top E2E priority): create → register → start →
// submit a full round (rankings/kills/commander/votes) → advance-round →
// turn-back-round from round 2 (the "reopen previous round" branch, not
// covered by turn-back-round.e2e.spec.ts, which only exercises the
// round-1-to-registration branch) → re-advance → advance past the final
// round (tournament end). Every entity here is disposable (tagged players/
// league/tournament), deleted in afterEach regardless of outcome — never assert
// against or mutate pre-existing data.
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

async function fetchPairingIds(tournamentId: number, round: number): Promise<number[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pairings?tournament_id=eq.${tournamentId}&pairing_round=eq.${round}&select=pairing_id`, {
    headers: supabaseHeaders(),
  })
  const rows = await res.json() as { pairing_id: number }[]
  return rows.map(r => r.pairing_id)
}

async function fetchTournament(tournamentId: number) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tournaments?tournament_id=eq.${tournamentId}&select=*`, {
    headers: supabaseHeaders(),
  })
  const rows = await res.json() as Record<string, unknown>[]
  return rows[0]
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

/** Full teardown bypassing the app's own delete guards (pairings/standings/
 *  waitroom must be empty before a tournament can be deleted through the normal
 *  endpoint) — this test deliberately leaves real round data behind, so
 *  cleanup goes straight to Supabase, same class of test-only exception as
 *  cleanup.ts's player deletion. */
async function deepCleanTournament(tournamentId: number) {
  const pairingIds = [
    ...await fetchPairingIds(tournamentId, 1),
    ...await fetchPairingIds(tournamentId, 2)
  ]
  const headers = supabaseHeaders()

  if (pairingIds.length > 0) {
    const filter = pairingIds.map(id => `pairing_id.eq.${id}`).join(',')
    await fetch(`${SUPABASE_URL}/rest/v1/round_kills?or=(${filter})`, { method: 'DELETE', headers })
    await fetch(`${SUPABASE_URL}/rest/v1/round_results?or=(${filter})`, { method: 'DELETE', headers })
  }
  await fetch(`${SUPABASE_URL}/rest/v1/pairings?tournament_id=eq.${tournamentId}`, { method: 'DELETE', headers })
  await fetch(`${SUPABASE_URL}/rest/v1/standings?tournament_id=eq.${tournamentId}`, { method: 'DELETE', headers })
  await fetch(`${SUPABASE_URL}/rest/v1/waitroom?tournament_id=eq.${tournamentId}`, { method: 'DELETE', headers })
}

let playerIds: number[] = []
let leagueId: number | undefined
let tournamentId: number | undefined
let rulesetId: number | undefined

test.afterEach(async ({ request }) => {
  if (tournamentId !== undefined) {
    await deepCleanTournament(tournamentId).catch((err) => { console.error('[e2e cleanup] deepCleanTournament threw:', err) })
    await cleanup.tournament(request, tournamentId)
    tournamentId = undefined
  }
  if (leagueId !== undefined) {
    await cleanup.league(request, leagueId)
    leagueId = undefined
  }
  if (rulesetId !== undefined) {
    await cleanup.ruleset(request, rulesetId)
    rulesetId = undefined
  }
  for (const id of playerIds) {
    await cleanup.player(request, id)
  }
  playerIds = []
})

test('full tournament lifecycle: register, start, submit a round, advance, turn back, advance to the end', async ({ request }) => {
  // 4 disposable players (a full single-table round).
  for (let i = 0; i < 4; i++) {
    const res = await request.post('/api/players/create', {
      data: { player_name: testTag('Player'), player_surname: `E2E${i}` },
    })
    expect(res.ok()).toBe(true)
    const { player } = await res.json() as { player: { player_id: number } }
    playerIds.push(player.player_id)
  }

  // advance-round scores the closing round (resolveTournamentRuleset requires a
  // real ruleset_id on the league — unlike start.post.ts, which doesn't
  // score anything yet), so this needs a disposable ruleset too.
  const rulesetRes = await request.post('/api/rulesets/create', {
    data: {
      name: testTag('Ruleset'),
      rule_set_partecipation: 0,
      rule_set_kill: 1,
      rule_set_brew: 1,
      rule_set_play: 1,
      rule_set_rank1: 8,
      rule_set_rank2: 6,
      rule_set_rank3: 4,
      rule_set_rank4: 2,
    },
  })
  expect(rulesetRes.ok()).toBe(true)
  const { ruleset } = await rulesetRes.json() as { ruleset: { ruleset_id: number } }
  rulesetId = ruleset.ruleset_id

  const leagueRes = await request.post('/api/leagues/create', {
    data: { name: testTag('League'), startsAt: null, endsAt: null, rulesetId, validTournaments: null },
  })
  expect(leagueRes.ok()).toBe(true)
  const { league } = await leagueRes.json() as { league: { id: number } }
  leagueId = league.id

  // 2 rounds — enough to exercise advance-round, turn-back-round from round
  // 2 (the branch turn-back-round.e2e.spec.ts doesn't cover), and hitting
  // the final-round "tournament ends" transition.
  const tournamentRes = await request.post('/api/tournaments/create', {
    data: {
      tournament_name: testTag('Tournament'),
      league_id: leagueId,
      tournament_round_number: 2,
      tournament_round_duration: 30,
    },
  })
  expect(tournamentRes.ok()).toBe(true)
  const { event } = await tournamentRes.json() as { event: { tournament_id: number } }
  tournamentId = event.tournament_id

  const registerRes = await request.post(`/api/tournaments/${tournamentId}/register-player`, { data: { playerIds } })
  expect(registerRes.ok()).toBe(true)

  // ── Start: round 1 pairings generated ─────────────────────────────────────
  const startRes = await request.post(`/api/tournaments/${tournamentId}/start`, { data: { playerOrder: playerIds } })
  if (!startRes.ok()) throw new Error(`start failed: ${startRes.status()} ${await startRes.text()}`)

  let tournamentRow = await fetchTournament(tournamentId)
  expect(tournamentRow?.tournament_playing).toBe(true)
  expect(tournamentRow?.tournament_current_round).toBe(1)

  const round1PairingIds = await fetchPairingIds(tournamentId, 1)
  expect(round1PairingIds).toHaveLength(1)
  const [round1PairingId] = round1PairingIds

  // ── Submit a full round: rankings, kills, commander, votes ────────────────
  const rankingsRes = await request.post(`/api/pairings/${round1PairingId}/rankings`, {
    data: { rankings: playerIds.map((playerId, i) => ({ playerId, position: i + 1 })) },
  })
  if (!rankingsRes.ok()) throw new Error(`rankings submit failed: ${rankingsRes.status()} ${await rankingsRes.text()}`)

  const killsRes = await request.post(`/api/pairings/${round1PairingId}/kills`, {
    data: { kills: [{ killerId: playerIds[0], victimId: playerIds[1] }] },
  })
  if (!killsRes.ok()) throw new Error(`kills submit failed: ${killsRes.status()} ${await killsRes.text()}`)

  for (const playerId of playerIds) {
    const commanderRes = await request.post(`/api/pairings/${round1PairingId}/commander`, {
      data: { playerId, commander1: testTag('Commander'), commander2: null },
    })
    if (!commanderRes.ok()) throw new Error(`commander submit failed for player ${playerId}: ${commanderRes.status()} ${await commanderRes.text()}`)
  }

  for (let i = 0; i < playerIds.length; i++) {
    const nextPlayerId = playerIds[(i + 1) % playerIds.length]
    const votesRes = await request.post(`/api/pairings/${round1PairingId}/votes`, {
      data: { playerId: playerIds[i], brewVote: nextPlayerId, playVote: nextPlayerId },
    })
    if (!votesRes.ok()) throw new Error(`votes submit failed for player ${playerIds[i]}: ${votesRes.status()} ${await votesRes.text()}`)
  }

  expect(await countRoundResults(round1PairingIds)).toBe(playerIds.length)

  // ── Advance to round 2 ─────────────────────────────────────────────────────
  const advanceRes = await request.post(`/api/tournaments/${tournamentId}/advance-round`, {
    data: { currentRound: 1, playerOrder: playerIds },
  })
  if (!advanceRes.ok()) throw new Error(`advance-round failed: ${advanceRes.status()} ${await advanceRes.text()}`)
  const { hasEnded: hasEndedAfterRound1 } = await advanceRes.json() as { hasEnded: boolean }
  expect(hasEndedAfterRound1).toBe(false)

  tournamentRow = await fetchTournament(tournamentId)
  expect(tournamentRow?.tournament_current_round).toBe(2)
  expect(tournamentRow?.tournament_playing).toBe(true)

  const round2PairingIds = await fetchPairingIds(tournamentId, 2)
  expect(round2PairingIds).toHaveLength(1)

  // Submit round 2's ranking too, so turning it back has real data to clear
  // (the realistic case — see turn-back-round.e2e.spec.ts's same reasoning).
  const round2RankingsRes = await request.post(`/api/pairings/${round2PairingIds[0]}/rankings`, {
    data: { rankings: playerIds.map((playerId, i) => ({ playerId, position: i + 1 })) },
  })
  if (!round2RankingsRes.ok()) throw new Error(`round 2 rankings submit failed: ${round2RankingsRes.status()} ${await round2RankingsRes.text()}`)
  expect(await countRoundResults(round2PairingIds)).toBe(playerIds.length)

  // ── Turn back round 2 → reopens round 1 (the branch not covered by
  //    turn-back-round.e2e.spec.ts, which only exercises round-1-to-
  //    registration) — round 2's pairings/results must be gone afterward,
  //    round 1's must be untouched. ────────────────────────────────────────
  const turnBackRes = await request.post(`/api/tournaments/${tournamentId}/turn-back-round`, { data: { currentRound: 2 } })
  if (!turnBackRes.ok()) throw new Error(`turn-back-round failed: ${turnBackRes.status()} ${await turnBackRes.text()}`)

  tournamentRow = await fetchTournament(tournamentId)
  expect(tournamentRow?.tournament_current_round).toBe(1)
  expect(tournamentRow?.tournament_playing).toBe(true)

  expect(await fetchPairingIds(tournamentId, 2)).toHaveLength(0)
  expect(await countRoundResults(round1PairingIds)).toBe(playerIds.length)

  // ── Re-advance to round 2, then advance past the final round: the tournament
  //    must end (tournament_playing=false, tournament_current_round beyond the total
  //    round count). ──────────────────────────────────────────────────────
  const readvanceRes = await request.post(`/api/tournaments/${tournamentId}/advance-round`, {
    data: { currentRound: 1, playerOrder: playerIds },
  })
  if (!readvanceRes.ok()) throw new Error(`re-advance-round failed: ${readvanceRes.status()} ${await readvanceRes.text()}`)

  const finalAdvanceRes = await request.post(`/api/tournaments/${tournamentId}/advance-round`, {
    data: { currentRound: 2 },
  })
  if (!finalAdvanceRes.ok()) throw new Error(`final advance-round failed: ${finalAdvanceRes.status()} ${await finalAdvanceRes.text()}`)
  const { hasEnded: hasEndedAfterRound2 } = await finalAdvanceRes.json() as { hasEnded: boolean }
  expect(hasEndedAfterRound2).toBe(true)

  tournamentRow = await fetchTournament(tournamentId)
  expect(tournamentRow?.tournament_playing).toBe(false)
  expect(tournamentRow?.tournament_current_round).toBe(3)
})
