// test\nuxt\components\tournament\pairing\PairingsCard.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PairingsCard from '~/components/tournament/pairing/PairingsCard.vue'
import { defaultStubs, createI18nTestPlugin } from '#test/helpers/mocks'
import type { PairingWithResults, TablePlayer } from '#shared/utils/types'

// Both query composables hit Supabase via useSupabaseClient (a Nuxt runtime
// composable unavailable in a plain mount) — stub them out entirely so this
// test only exercises PairingsCard's own quick-fill wiring.
vi.mock('~/composables/commanders/useCommanderCatalogQuery', () => ({
  useCommanderCatalogQuery: () => ({ data: { value: [] } }),
}))
vi.mock('~/composables/commanders/useCommanderUsageQuery', () => ({
  useCommanderUsageQuery: () => ({ data: { value: new Map() } }),
}))

const pairing: PairingWithResults = {
  pairing_id: 1,
  tournament_id: 1,
  pairing_round: 1,
  pairing_datetime: null,
  pairing_is_full: true,
  pairing_player1_id: 1,
  pairing_player2_id: 2,
  pairing_player3_id: null,
  pairing_player4_id: null,
  round_results: [],
}

const allPlayers: TablePlayer[] = [
  { id: 1, name: 'Alice', surname: 'A' },
  { id: 2, name: 'Bob', surname: 'B' },
]

function mountPairingsCard() {
  return mount(PairingsCard, {
    props: { pairings: [pairing], allPlayers },
    global: {
      stubs: {
        ...defaultStubs,
        UCard: { name: 'UCard', template: '<div><slot name="header" /><slot /><slot name="footer" /></div>' },
        UEmpty: true,
        PairingsFullscreenView: true,
        TableCardActions: true,
        PairingPlayerRow: true,
        PairingTableActions: true,
        QuickFillButton: { name: 'QuickFillButton', template: '<button @click="$emit(\'click\')" />' },
        // handleConfirm branches purely on confirmDialog.value.type (set by
        // the click above), not on which of the five ConfirmModal instances
        // fires — so a single trivial stub is enough to drive every case.
        ConfirmModal: { name: 'ConfirmModal', props: ['open'], template: '<div />' },
      },
      plugins: [createI18nTestPlugin({})],
    },
  })
}

describe('PairingsCard — "Compila con dati di test"', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
  })

  it('persists the kill server-side so the table can be marked complete', async () => {
    const fetchMock = vi.fn().mockResolvedValue({})
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = mountPairingsCard()

    // Header "compila tutti" button — QuickFillButton is the only one of
    // that name in the render tree (the per-table one lives inside the
    // stubbed-out TableCardActions).
    await wrapper.findComponent({ name: 'QuickFillButton' }).vm.$emit('click')
    await wrapper.findComponent({ name: 'ConfirmModal' }).vm.$emit('confirm')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pairings/1/kills',
      { method: 'POST', body: { kills: [{ killerId: 1, victimId: 2 }] } }
    )
    expect(wrapper.emitted('refreshPairings')).toHaveLength(1)
  })

  it('shows an error toast when the server rejects the kill save', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'))
    vi.stubGlobal('$fetch', fetchMock)
    const addToast = vi.fn()
    vi.stubGlobal('useToast', () => ({ add: addToast }))

    const wrapper = mountPairingsCard()

    await wrapper.findComponent({ name: 'QuickFillButton' }).vm.$emit('click')
    await wrapper.findComponent({ name: 'ConfirmModal' }).vm.$emit('confirm')
    await flushPromises()

    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
    expect(wrapper.emitted('refreshPairings')).toHaveLength(1)
  })
})
