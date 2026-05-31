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
