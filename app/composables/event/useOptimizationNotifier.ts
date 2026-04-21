import type { Ref } from 'vue'
import type { TournamentTable } from '#shared/utils/types'
import type { PairingScoreDetails } from '~/composables/events/pairing/pairingOptimizer'

interface ToastApi {
  add: (payload: {
    title: string
    description: string
    color?: 'success' | 'warning' | 'error' | 'neutral' | 'primary' | 'secondary' | 'info'
  }) => void
}

interface Params {
  toast: ToastApi
  isValid: Ref<boolean>
  previewError: Ref<string>
  scoreDetails: Ref<PairingScoreDetails>
  cloneCurrentTables: () => TournamentTable[]
  restoreTables: (tables: TournamentTable[]) => void
  runOptimizer: (swapTimeBudgetMs?: number) => boolean
}

function changedTableNumbers(beforeTableTotals: number[], afterTableTotals: number[]) {
  return afterTableTotals.reduce<number[]>((acc, nextTableTotal, index) => {
    const previous = beforeTableTotals[index]
    if (previous === undefined) {
      acc.push(index + 1)
      return acc
    }

    if (Math.abs(nextTableTotal - previous) > 0.001) {
      acc.push(index + 1)
    }

    return acc
  }, [])
}

function notifyOptimizationResult(toast: ToastApi, params: {
  changed: boolean
  beforeTotal: number
  afterTotal: number
  beforeTableTotals: number[]
  afterTableTotals: number[]
  successTitle: string
  noChangeTitle: string
}) {
  if (!params.changed || params.afterTotal <= params.beforeTotal) {
    toast.add({
      title: params.noChangeTitle,
      description: 'Non sono stati trovati miglioramenti con i vincoli correnti',
      color: 'neutral',
    })
    return
  }

  const delta = params.afterTotal - params.beforeTotal
  const changedTables = changedTableNumbers(params.beforeTableTotals, params.afterTableTotals)

  toast.add({
    title: params.successTitle,
    description: `+${delta.toFixed(2)} punti, tavoli aggiornati: ${changedTables.join(', ') || 'nessuno'}`,
    color: 'success',
  })
}

export function useOptimizationNotifier(params: Params) {
  function optimizeNow() {
    const beforeTotal = params.scoreDetails.value.totalScore
    const beforeTableTotals = params.scoreDetails.value.tableScores.map(table => table.total)

    const changed = params.runOptimizer(220)

    const afterTotal = params.scoreDetails.value.totalScore
    const afterTableTotals = params.scoreDetails.value.tableScores.map(table => table.total)

    notifyOptimizationResult(params.toast, {
      changed,
      beforeTotal,
      afterTotal,
      beforeTableTotals,
      afterTableTotals,
      successTitle: 'Ottimizzazione completata',
      noChangeTitle: 'Accoppiamenti già ottimizzati',
    })
  }

  function autoResolveConflicts() {
    const snapshot = params.cloneCurrentTables()
    const beforeTotal = params.scoreDetails.value.totalScore
    const beforeTableTotals = params.scoreDetails.value.tableScores.map(table => table.total)

    const changed = params.runOptimizer(220)

    if (!params.isValid.value) {
      params.restoreTables(snapshot)
      params.toast.add({
        title: 'Risoluzione conflitti non riuscita',
        description: params.previewError.value || 'Nessuna soluzione valida trovata',
        color: 'error',
      })
      return
    }

    const afterTotal = params.scoreDetails.value.totalScore
    const afterTableTotals = params.scoreDetails.value.tableScores.map(table => table.total)

    if (afterTotal < beforeTotal) {
      params.restoreTables(snapshot)
      params.toast.add({
        title: 'Accoppiamenti già ottimizzati',
        description: 'Non sono stati trovati miglioramenti con i vincoli correnti',
        color: 'neutral',
      })
      return
    }

    notifyOptimizationResult(params.toast, {
      changed,
      beforeTotal,
      afterTotal,
      beforeTableTotals,
      afterTableTotals,
      successTitle: 'Risoluzione conflitti completata',
      noChangeTitle: 'Accoppiamenti già ottimizzati',
    })
  }

  return {
    optimizeNow,
    autoResolveConflicts,
  }
}
