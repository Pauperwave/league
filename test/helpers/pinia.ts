// test\helpers\pinia.ts
// fallow-ignore-file unused-file -- store test scaffolding, PROGRESS.md #6; not wired to any test yet
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
