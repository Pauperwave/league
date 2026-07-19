// test\e2e\global.setup.ts
// Logs in once via the real site-password gate and saves the session cookie,
// reused by every other spec (playwright.config.ts's chromium project storageState).
import { test as setup } from '@playwright/test'

const STORAGE_STATE = 'test/e2e/.auth/state.json'

setup('authenticate', async ({ page }) => {
  const password = process.env.NUXT_SITE_PASSWORD
  if (!password) {
    throw new Error('NUXT_SITE_PASSWORD must be set in the environment running Playwright (same as .env).')
  }

  await page.goto('/login')
  // Nuxt hydration gotcha: filling before the client takes over means the
  // v-model listener isn't attached yet, so the submit button never enables.
  // networkidle is a reasonable proxy for "hydration has finished" without
  // pulling in @nuxt/test-utils/playwright's heavier `nuxt` fixture (see
  // playwright.config.ts's comment on why that's avoided).
  await page.waitForLoadState('networkidle')
  await page.getByPlaceholder('Inserisci la password').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'))

  await page.context().storageState({ path: STORAGE_STATE })
})
