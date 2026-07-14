// test\helpers\pinia.ts
// fallow-ignore-file unused-file -- test scaffolding for the store unit tests tracked in docs/PROGRESS.md ("Prossimi passi" #6); not wired to any test yet
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach } from 'vitest'

/**
 * Creates and activates a fresh Pinia instance.
 * Call within describe blocks that use stores.
 */
export function createTestPinia() {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  return () => pinia
}
