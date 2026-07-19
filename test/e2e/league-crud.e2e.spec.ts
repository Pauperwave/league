// test\e2e\league-crud.e2e.spec.ts
// First real E2E spec (BACKLOG #1). Runs against the real production
// Supabase project — every entity created here is tagged (testTag.ts) and
// deleted in afterEach regardless of test outcome (cleanup.ts). Never assert
// against or mutate pre-existing rows.
import { expect, test } from '@playwright/test'
import { cleanup } from './helpers/cleanup'
import { testTag } from './helpers/testTag'

let createdLeagueId: number | undefined

test.afterEach(async ({ request }) => {
  if (createdLeagueId !== undefined) {
    await cleanup.league(request, createdLeagueId)
    createdLeagueId = undefined
  }
})

test('create, edit, and delete a league', async ({ page }) => {
  const name = testTag('League')
  const editedName = `${name} EDITED`

  await page.goto('/leagues')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Nuova Lega' }).click()
  await page.waitForLoadState('networkidle')
  const nameField = page.getByLabel('Nome Lega')
  await nameField.fill(name)
  await expect(nameField).toHaveValue(name)

  const [createResponse] = await Promise.all([
    // Exact pathname match, not includes() — under slowMo a loose substring
    // match raced against an unrelated response with an empty body.
    page.waitForResponse(res => new URL(res.url()).pathname === '/api/leagues/create' && res.request().method() === 'POST'),
    page.getByRole('button', { name: 'Crea Lega' }).click(),
  ])
  if (!createResponse.ok()) {
    throw new Error(`league create failed: ${createResponse.status()} ${await createResponse.text()}`)
  }
  const created = await createResponse.json() as { league: { id: number } }
  createdLeagueId = created.league.id

  const row = page.getByRole('row', { name })
  await expect(row).toBeVisible()

  // Edit
  await row.getByRole('button', { name: 'Modifica' }).click()
  const nameInput = page.getByLabel('Nome Lega')
  await nameInput.fill('')
  await nameInput.fill(editedName)

  const [updateResponse] = await Promise.all([
    page.waitForResponse(res => new URL(res.url()).pathname === `/api/leagues/${createdLeagueId}/update` && res.request().method() === 'POST'),
    page.getByRole('button', { name: 'Salva' }).click(),
  ])
  if (!updateResponse.ok()) {
    console.error('[e2e debug] update request body:', updateResponse.request().postData())
    throw new Error(`league update failed: ${updateResponse.status()} ${await updateResponse.text()}`)
  }

  await expect(page.getByRole('row', { name: editedName })).toBeVisible()

  // Delete
  const editedRow = page.getByRole('row', { name: editedName })
  await editedRow.getByRole('button', { name: 'Rimuovi' }).click()
  await page.getByRole('button', { name: 'Elimina' }).click()
  await expect(page.getByRole('row', { name: editedName })).toHaveCount(0)

  createdLeagueId = undefined // already deleted through the UI — afterEach has nothing to do
})
