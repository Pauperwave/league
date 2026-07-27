// test\e2e\pairing-preview-swap.e2e.spec.ts
// UI-driven reproduction of the ADR-037 fix: dragging a player from one full
// (4/4) table onto another full table in the "Anteprima Tavoli" preview must
// swap the two players instead of being silently rejected. Preconditions
// (players/league/event/registration) are seeded via the API for speed —
// only the drag itself is driven through the real UI, same split as
// deck-create.e2e.spec.ts. The event is never actually started (the preview
// opens before that BFF call, and this test cancels out of it), so cleanup
// only ever has to remove the event/league/players, never pairings/standings.
import { expect, test } from '@playwright/test'
import { cleanup } from './helpers/cleanup'
import { testTag } from './helpers/testTag'

let playerIds: number[] = []
let leagueId: number | undefined
let eventId: number | undefined
const playerSurnames: string[] = []

test.afterEach(async ({ request }) => {
  if (eventId !== undefined) {
    // The event/delete endpoint 409s while any waitroom rows reference it —
    // this test registers players via the API but never unregisters them
    // (there's no round to withdraw from, the modal is only cancelled), so
    // cleanup must clear the waitroom first.
    await request.post(`/api/events/${eventId}/unregister-player`, { data: { playerIds } })
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
  playerSurnames.length = 0
})

test('dragging a player from one full table to another swaps them instead of rejecting the move', async ({ page, request }) => {
  // 8 disposable players (2 full tables of 4) — same first name (testTag),
  // distinct surnames so each is uniquely identifiable in the DOM.
  for (let i = 0; i < 8; i++) {
    const surname = `E2ESwap${i}`
    const res = await request.post('/api/players/create', {
      data: { player_name: testTag('Player'), player_surname: surname },
    })
    expect(res.ok()).toBe(true)
    const { player } = await res.json() as { player: { player_id: number } }
    playerIds.push(player.player_id)
    playerSurnames.push(surname)
  }

  const leagueRes = await request.post('/api/leagues/create', {
    data: { name: testTag('League'), startsAt: null, endsAt: null, rulesetId: null, validEvents: null },
  })
  expect(leagueRes.ok()).toBe(true)
  const { league } = await leagueRes.json() as { league: { id: number } }
  leagueId = league.id

  const eventRes = await request.post('/api/events/create', {
    data: {
      event_name: testTag('Event'),
      league_id: leagueId,
      event_round_number: 2,
      event_round_duration: 30,
    },
  })
  expect(eventRes.ok()).toBe(true)
  const { event } = await eventRes.json() as { event: { event_id: number } }
  eventId = event.event_id

  const registerRes = await request.post(`/api/events/${eventId}/register-player`, { data: { playerIds } })
  expect(registerRes.ok()).toBe(true)

  await page.goto(`/league/${leagueId}/event/${eventId}`)
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Avvia Evento' }).click()
  const dialog = page.getByRole('dialog', { name: 'Anteprima Tavoli' })
  await expect(dialog).toBeVisible()

  const table1 = dialog.locator('[data-testid="table-card-1"]')
  const table2 = dialog.locator('[data-testid="table-card-2"]')
  await expect(table1).toBeVisible()
  await expect(table2).toBeVisible()

  async function surnamesIn(table: typeof table1): Promise<string[]> {
    const present: string[] = []
    for (const surname of playerSurnames) {
      if (await table.getByText(surname, { exact: true }).count() > 0) present.push(surname)
    }
    return present
  }

  const table1Before = await surnamesIn(table1)
  const table2Before = await surnamesIn(table2)
  expect(table1Before).toHaveLength(4)
  expect(table2Before).toHaveLength(4)

  // Drag the first seated player in table 1 onto table 2 — both tables are
  // full, so a plain move would leave table 2 at 5/table 1 at 3 (invalid);
  // attemptTableSwap should turn it into a swap instead. TableCard.vue's
  // VueDraggable uses forceFallback (mouse-simulated drag, not native HTML5
  // DnD), so a plain mouse down/move/up sequence drives it.
  const movedSurname = table1Before[0]!
  const dragHandle = table1.getByRole('button', { name: 'Trascina giocatore' }).first()
  const dropTarget = table2.locator('.grid').first()

  const handleBox = await dragHandle.boundingBox()
  const targetBox = await dropTarget.boundingBox()
  if (!handleBox || !targetBox) throw new Error('Could not resolve drag handle/drop target bounding boxes')

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 20, handleBox.y + handleBox.height / 2, { steps: 5 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 })
  await page.mouse.up()

  // No "invalid move" toast — the swap should have resolved the arrangement.
  await expect(page.getByText('Spostamento non valido')).toHaveCount(0)

  const table1After = await surnamesIn(table1)
  const table2After = await surnamesIn(table2)

  expect(table1After).toHaveLength(4)
  expect(table2After).toHaveLength(4)
  // The dragged player must have landed in table 2.
  expect(table2After).toContain(movedSurname)
  expect(table1After).not.toContain(movedSurname)
  // Exactly one of table 2's original occupants must have swapped back into table 1.
  const swappedBack = table1After.filter(s => table2Before.includes(s))
  expect(swappedBack).toHaveLength(1)
  // Every player accounted for exactly once across both tables.
  expect([...table1After, ...table2After].sort()).toEqual([...playerSurnames].sort())

  // Cancel out — never actually start the event, so cleanup has nothing to
  // do beyond the event/league/players (no pairings/standings ever created).
  await dialog.getByRole('button', { name: 'Annulla' }).click()
})
