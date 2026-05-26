import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { TournamentPlayer, TournamentTable } from '#shared/utils/types'
import type { PairingHistoryEntry, PairingPlayer } from '~/composables/events/pairing/pairingOptimizer'
import TablePreviewModal from './TablePreviewModal.vue'

const runOptimizerMock = vi.fn(() => true)

vi.mock('~/composables/tables/useTableDnd', async () => {
  const vue = await import('vue')
  return {
    useTableDnd: () => ({
      localTables: vue.ref([] as TournamentTable[]),
      isDragging: vue.ref(false),
      isValid: vue.ref(true),
      previewError: vue.ref(''),
      playerOrder: vue.ref([] as number[]),
      tableStatus: vi.fn(() => ({ color: 'success', label: '4/4' })),
      setDragging: vi.fn(),
      reset: vi.fn(),
      syncFromSource: vi.fn(),
      normalizeLocalTables: vi.fn(),
      cloneCurrentTables: vi.fn(() => []),
      restoreTables: vi.fn(),
      runOptimizer: runOptimizerMock,
      scoreDetails: vue.ref({ totalScore: 0, tableScores: [] }),
      weights: vue.ref({
        strengthBalance: 1,
        novelty: 1,
        rematch: 1,
        rotateTable3: 1,
        tableSize4: 1,
        tableSize3: 1,
      }),
      forbiddenPairs: vue.ref([]),
      addForbiddenPair: vi.fn(),
      removeForbiddenPair: vi.fn(),
      setWeights: vi.fn(),
      setForbiddenPairs: vi.fn(),
      conflictingTables: vue.ref(new Set<number>()),
    }),
  }
})

vi.mock('#imports', () => {
  return {
    useToast: () => ({ add: vi.fn() }),
  }
})

vi.mock('~/composables/useButtonLogging', () => {
  return {
    useButtonLogging: () => ({ logClick: vi.fn() }),
  }
})

vi.mock('~/composables/event/useOptimizationNotifier', () => {
  return {
    useOptimizationNotifier: () => ({
      optimizeNow: vi.fn(),
      autoResolveConflicts: vi.fn(),
    }),
  }
})

vi.mock('~/composables/event/usePairingPresets', () => {
  return {
    usePairingPresets: () => ({
      selectedPreset: { value: 'balanced' },
      applyWeightPreset: vi.fn(),
    }),
  }
})

vi.mock('~/composables/events/pairing/pairingPreferences', () => {
  return {
    getPairingPreferences: () => ({ weights: {
      strengthBalance: 1,
      novelty: 1,
      rematch: 1,
      rotateTable3: 1,
      tableSize4: 1,
      tableSize3: 1,
    }, forbiddenPairs: [] }),
    savePairingPreferences: vi.fn(),
  }
})

describe('TablePreviewModal', () => {
  it('auto-optimizes only on open and not on confirm', async () => {
    runOptimizerMock.mockClear()

    const wrapper = mount(TablePreviewModal, {
      props: {
        open: false,
        tables: [] as TournamentTable[],
        eventId: 1,
        playersForScoring: [{ id: 1, rank: 1, score: 10, table3Count: 0 }] as PairingPlayer[],
        history: [] as PairingHistoryEntry[],
        currentRound: 1,
        allPlayers: [] as TournamentPlayer[],
      },
      global: {
        stubs: {
          UModal: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
          UButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          TablePreviewToolbar: { template: '<div />' },
          TablePreviewGrid: { template: '<div />' },
          PairingSettingsModal: { template: '<div />' },
          TableScoreBreakdownModal: { template: '<div />' },
        },
        mocks: {
          $toast: { add: vi.fn() },
        },
      },
    })

    expect(runOptimizerMock).not.toHaveBeenCalled()

    await wrapper.setProps({ open: true })
    expect(runOptimizerMock).toHaveBeenCalledTimes(1)

    const buttons = wrapper.findAll('button')
    const confirmButton = buttons.find(button => button.text() === 'Conferma')
    expect(confirmButton).toBeTruthy()

    await confirmButton?.trigger('click')
    expect(runOptimizerMock).toHaveBeenCalledTimes(1)
  })
})
