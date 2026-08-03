// test\e2e\pairing-preview-swap.e2e.spec.ts
// UI-driven check for the ADR-049 behavior: dragging a player from one full
// (4/4) table onto another full table in the "Anteprima Tavoli" preview is no
// longer auto-resolved into a swap or silently reverted (that was ADR-037's
// approach) — the drop is applied as-is, leaving both tables temporarily
// invalid (5/3), and "Conferma" is disabled until the arrangement is fixed
// (either by dragging someone back, or via the swap the user performs by hand).
// Preconditions (players/league/tournament/registration) are seeded via the API
// for speed — only the drag itself is driven through the real UI, same split as
// deck-create.e2e.spec.ts. The tournament is never actually started (the preview
// opens before that BFF call, and this test cancels out of it), so cleanup only
// ever has to remove the tournament/league/players, never pairings/standings.
import { expect, test } from '@playwright/test'
import { cleanup } from './helpers/cleanup'
import { testTag } from './helpers/testTag'

let playerIds: number[] = []
let leagueId: number | undefined
let tournamentId: number | undefined
const playerSurnames: string[] = []

test.afterEach(async ({ request }) => {
  if (tournamentId !== undefined) {
    // The tournament/delete endpoint 409s while any waitroom rows reference it —
    // this test registers players via the API but never unregisters them
    // (there's no round to withdraw from, the modal is only cancelled), so
    // cleanup must clear the waitroom first.
    await request.post(`/api/tournaments/${tournamentId}/unregister-player`, { data: { playerIds } })
    await cleanup.tournament(request, tournamentId)
    tournamentId = undefined
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

test('dragging a player from one full table to another leaves the drop as-is and disables Confirm until fixed', async ({ page, request }) => {
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
    data: { name: testTag('League'), startsAt: null, endsAt: null, rulesetId: null, validTournaments: null },
  })
  expect(leagueRes.ok()).toBe(true)
  const { league } = await leagueRes.json() as { league: { id: number } }
  leagueId = league.id

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

  await page.goto(`/league/${leagueId}/tournament/${tournamentId}`)
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Avvia Torneo' }).click()
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

  const confirmButton = dialog.getByRole('button', { name: 'Conferma' })
  await expect(confirmButton).toBeEnabled()

  // Drag the THIRD seated player in table 1 onto table 2 — deliberately not
  // the first, so this actually exercises "the dragged player is whichever
  // handle the mouse is on," not just index 0. Both tables are full, so this
  // now simply leaves table 2 at 5 and table 1 at 3 — no auto-swap, no
  // revert. TableCard.vue's VueDraggable uses forceFallback (mouse-simulated
  // drag, not native HTML5 DnD), so a plain mouse down/move/up drives it.
  const movedSurname = table1Before[2]!
  const dragHandle = table1.getByRole('button', { name: 'Trascina giocatore' }).nth(2)
  const dropTarget = table2.locator('.grid').first()

  const handleBox = await dragHandle.boundingBox()
  const targetBox = await dropTarget.boundingBox()
  if (!handleBox || !targetBox) throw new Error('Could not resolve drag handle/drop target bounding boxes')

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 20, handleBox.y + handleBox.height / 2, { steps: 5 }
  )
  await page.mouse.move(
    targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 }
  )
  await page.mouse.up()

  // The drop landed as-is: table 2 now holds the moved player alongside its
  // original 4 (5 total), table 1 is down to 3 — no auto-swap resolved it.
  const table1After = await surnamesIn(table1)
  const table2After = await surnamesIn(table2)
  expect(table1After).toHaveLength(3)
  expect(table2After).toHaveLength(5)
  expect(table2After).toContain(movedSurname)
  expect(table1After).not.toContain(movedSurname)

  // The arrangement is invalid (a table outside 3-4 occupants) — Confirm
  // must be disabled until the user fixes it themselves.
  await expect(confirmButton).toBeDisabled()

  // Cancel out — never actually start the tournament, so cleanup has nothing to
  // do beyond the tournament/league/players (no pairings/standings ever created).
  await dialog.getByRole('button', { name: 'Annulla' }).click()
})
