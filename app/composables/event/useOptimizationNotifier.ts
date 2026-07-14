// app\composables\event\useOptimizationNotifier.ts
import type { Ref } from 'vue'
import type { TournamentTable } from '#shared/utils/types'
import type { PairingScoreDetails } from '~/composables/event-pairing/pairingOptimizer'

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

    if (!isCloseTo(nextTableTotal, previous)) {
      acc.push(index + 1)
    }

    return acc
  }, [])
}

function notifyOptimizationResult(toast: ToastApi, t: ReturnType<typeof useI18n>['t'], params: {
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
      description: t('event.optimizer.noImprovements'),
      color: 'neutral',
    })
    return
  }

  const delta = params.afterTotal - params.beforeTotal
  const changedTables = changedTableNumbers(params.beforeTableTotals, params.afterTableTotals)

  toast.add({
    title: params.successTitle,
    description: t('event.optimizer.improvedDescription', {
      delta: delta.toFixed(2),
      tables: changedTables.join(', ') || t('event.optimizer.noneFallback'),
    }),
    color: 'success',
  })
}

export function useOptimizationNotifier(params: Params) {
  const { t } = useI18n()

  function optimizeNow() {
    const beforeTotal = params.scoreDetails.value.totalScore
    const beforeTableTotals = params.scoreDetails.value.tableScores.map(table => table.total)

    const changed = params.runOptimizer(220)

    const afterTotal = params.scoreDetails.value.totalScore
    const afterTableTotals = params.scoreDetails.value.tableScores.map(table => table.total)

    notifyOptimizationResult(params.toast, t, {
      changed,
      beforeTotal,
      afterTotal,
      beforeTableTotals,
      afterTableTotals,
      successTitle: t('event.optimizer.optimizationCompleteTitle'),
      noChangeTitle: t('event.optimizer.alreadyOptimizedTitle'),
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
        title: t('event.optimizer.conflictResolutionFailedTitle'),
        description: params.previewError.value || t('event.optimizer.noValidSolutionFallback'),
        color: 'error',
      })
      return
    }

    const afterTotal = params.scoreDetails.value.totalScore
    const afterTableTotals = params.scoreDetails.value.tableScores.map(table => table.total)

    if (afterTotal < beforeTotal) {
      params.restoreTables(snapshot)
      params.toast.add({
        title: t('event.optimizer.alreadyOptimizedTitle'),
        description: t('event.optimizer.noImprovements'),
        color: 'neutral',
      })
      return
    }

    notifyOptimizationResult(params.toast, t, {
      changed,
      beforeTotal,
      afterTotal,
      beforeTableTotals,
      afterTableTotals,
      successTitle: t('event.optimizer.conflictResolutionCompleteTitle'),
      noChangeTitle: t('event.optimizer.alreadyOptimizedTitle'),
    })
  }

  return {
    optimizeNow,
    autoResolveConflicts,
  }
}
