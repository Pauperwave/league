// test\e2e\deck-create.e2e.spec.ts
// Runs against the real production Supabase project — every entity created
// here is tagged (testTag.ts) and deleted in afterEach regardless of test
// outcome (cleanup.ts). Never assert against or mutate pre-existing rows.
//
// Uses a REAL existing player as the deck owner (id 297, "Giorgio Dalvit")
// — only the disposable deck is created/deleted, the player itself is never
// touched. The commander name is a fake tag, not a real Magic card, so no
// Scryfall art loads: ImageWithFallback.vue renders no <img>/alt at all when
// `src` is null (just an icon fallback), and CommanderArt.vue only shows the
// visible name heading once art actually loaded — so the card is asserted via
// its "Statistiche" link href (built from the commander slug), which always
// renders regardless of art. Only covers create: locating the specific deck
// card's edit/delete buttons reliably (no art, no visible name) needs more
// DOM investigation than this first pass — see BACKLOG #1.
import { expect, test } from '@playwright/test'
import { slugify } from '../../app/utils/slug'
import { cleanup } from './helpers/cleanup'
import { testTag } from './helpers/testTag'

const OWNER_PLAYER_SLUG = 'giorgio-dalvit'

let createdDeckId: number | undefined

test.afterEach(async ({ request }) => {
  if (createdDeckId !== undefined) {
    await cleanup.deck(request, createdDeckId)
    createdDeckId = undefined
  }
})

test('create a deck', async ({ page }) => {
  const commanderName = testTag('Commander')

  await page.goto(`/player/${OWNER_PLAYER_SLUG}`)
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Aggiungi Deck' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Commander').fill(commanderName)

  const [createResponse] = await Promise.all([
    page.waitForResponse(res => new URL(res.url()).pathname === '/api/decks/create' && res.request().method() === 'POST'),
    dialog.getByRole('button', { name: 'Aggiungi' }).click(),
  ])
  if (!createResponse.ok()) {
    throw new Error(`deck create failed: ${createResponse.status()} ${await createResponse.text()}`)
  }
  const created = await createResponse.json() as { deck: { id: number } }
  createdDeckId = created.deck.id

  const deckSlug = slugify(commanderName)
  await expect(page.getByRole('link', { name: 'Statistiche' }).and(page.locator(`[href$="/deck/${deckSlug}"]`))).toBeVisible()
})
