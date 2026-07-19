// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

// Visual debugging: `pnpm test:e2e:headed` (PW_SLOWMO=1 under the hood, via
// cross-env for Windows/PowerShell) runs headed with a 2s delay between
// actions, so you can actually watch the browser instead of it running
// headless/instant. Off by default — `pnpm test:e2e` stays fast.
const slowMode = !!process.env.PW_SLOWMO

// E2E runs against the real Supabase project (BACKLOG #1) — this repo has no
// local Supabase/Docker stack available for a fully isolated test DB. Every
// spec must only ever create/mutate/delete entities it created itself in that
// same test (see test/e2e/helpers/testTag.ts) — never touch pre-existing data.
//
// Plain @playwright/test config, NOT @nuxt/test-utils/playwright's `nuxt`
// fixture: that fixture builds and manages its own separate Nuxt instance,
// which conflicts with (and times out alongside) the `webServer` below —
// tried it, it double-builds and the setup project hangs on _nuxtHooks.
// `webServer` + a networkidle wait after each goto (see global.setup.ts) is
// simpler and sufficient for this suite's needs.
export default defineConfig({
  testDir: './test/e2e',
  // Shared production data + a single shared login session: parallel workers
  // would race each other's waitroom/standings state. Keep this serial until
  // there's a real reason to parallelize.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    headless: !slowMode,
    launchOptions: slowMode ? { slowMo: 2000 } : {},
  },
  // Runs the production build, not `pnpm dev`: the dev server (Vite/Nitro)
  // was observed returning empty-body error responses for real, correctly-
  // rejected requests (schema-invalid update sent a valid-looking payload
  // and 400'd with no body) — a dev-only quirk, not an app bug. The built
  // server (what actually deploys) handled the same flow correctly and
  // ~3x faster. `pnpm build` runs once before `webServer` starts it.
  webServer: {
    command: 'pnpm build && node .output/server/index.mjs',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'test/e2e/.auth/state.json',
      },
      dependencies: ['setup'],
    },
  ],
})
