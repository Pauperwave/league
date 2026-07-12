// fallow-ignore-file unused-file -- test scaffolding for the store unit tests tracked in docs/PROGRESS.md ("Prossimi passi" #6); not wired to any test yet
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach } from 'vitest'

/**
 * Crea e attiva una Pinia fresh.
 * Chiamare nei describe block che usano store.
 */
export function createTestPinia() {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  return () => pinia
}
