// test\e2e\player-create.e2e.spec.ts
// Runs against the real production Supabase project — every entity created
// here is tagged (testTag.ts) and deleted in afterEach regardless of test
// outcome (cleanup.ts). Never assert against or mutate pre-existing rows.
//
// No update/delete coverage here: /players only exposes create (no edit
// button/row action on this page — player update only happens in the event
// waiting-list context, see useEventPlayers.ts) and there is no player
// delete endpoint at all, deliberately (see api.md).
import { expect, test } from '@playwright/test'
import { cleanup } from './helpers/cleanup'
import { testTag } from './helpers/testTag'

let createdPlayerId: number | undefined

test.afterEach(async ({ request }) => {
  if (createdPlayerId !== undefined) {
    await cleanup.player(request, createdPlayerId)
    createdPlayerId = undefined
  }
})

test('create a player', async ({ page }) => {
  const firstName = testTag('Firstname')
  const lastName = 'E2ETestLastname'

  await page.goto('/players')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Crea Giocatore' }).click()
  const dialog = page.getByRole('dialog')
  // exact: true — "Nome" is a case-insensitive substring of "Cognome",
  // Playwright's default getByLabel matching would resolve both otherwise.
  await dialog.getByLabel('Nome', { exact: true }).fill(firstName)
  await dialog.getByLabel('Cognome').fill(lastName)

  const [createResponse] = await Promise.all([
    page.waitForResponse(res => new URL(res.url()).pathname === '/api/players/create' && res.request().method() === 'POST'),
    // Scoped to the dialog: "Crea Giocatore" also labels the page header
    // button that opened it, ambiguous once both are in the DOM together.
    dialog.getByRole('button', { name: 'Crea Giocatore' }).click(),
  ])
  if (!createResponse.ok()) {
    throw new Error(`player create failed: ${createResponse.status()} ${await createResponse.text()}`)
  }
  const created = await createResponse.json() as { player: { player_id: number } }
  createdPlayerId = created.player.player_id

  // /players renders a card grid (PlayersGrid.vue), not a table — no row role.
  await expect(page.getByText(`${firstName} ${lastName}`)).toBeVisible()
})
