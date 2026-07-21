// app\composables\event\useWinnerChecklist.ts
import type { PairingWithResults, TournamentPlayer } from '#shared/utils/types'

export interface WinnerChecklistEntry {
  pairingId: number
  tableNumber: number
  players: TournamentPlayer[]
}

function winnerChecklistKey(eventId: number, round: number): string {
  return `winner-checklist-${eventId}-${round}`
}

// The key is already round-scoped (resets every round on its own) — this
// just needs to outlive a single league night.
const CHECKLIST_TTL_MS = 24 * 60 * 60 * 1000

/**
 * "Who won this table" panel data (BACKLOG #15) — winners are derived live
 * from rankingsStore (rank === 1 per pairing), no new DB state. Table number
 * matches the existing "array index + 1" convention used everywhere else
 * (PairingsCard.vue, ConfirmModal subjects — see BACKLOG #14 on why this is
 * implicit rather than a real column). A "Patta" (draw) pairing ties every
 * seated player for rank 1 too, but nobody actually *won* the table — skipped
 * via the same `isPairingDraw` check `PairingsCard.vue` uses, so the two
 * places agree on what counts as a draw without duplicating the logic.
 */
export function useWinners(
  pairings: Ref<PairingWithResults[]>,
  tournamentPlayers: Ref<TournamentPlayer[]>,
  rankingsStore: ReturnType<typeof import('~/stores/rankings').useRankingsStore>
) {
  return computed<WinnerChecklistEntry[]>(() => {
    const playersById = new Map(tournamentPlayers.value.map(p => [p.id, p]))

    return pairings.value.reduce<WinnerChecklistEntry[]>((entries, pairing, index) => {
      const ranking = rankingsStore.getRankingWithRanks(pairing.pairing_id)
      const winnerIds = (ranking ?? []).filter(r => r.rank === 1).map(r => r.playerId)
      if (winnerIds.length === 0) return entries
      if (isPairingDraw(pairing, ranking)) return entries

      entries.push({
        pairingId: pairing.pairing_id,
        tableNumber: index + 1,
        players: winnerIds.map(id => playersById.get(id)).filter((p): p is TournamentPlayer => !!p),
      })
      return entries
    }, [])
  })
}

/**
 * Persisted "booster consegnato" check-off state per player for the current
 * round — who won is derived live elsewhere; this only tracks whether their
 * reward has physically been handed over. Keyed by event+round, so it
 * naturally resets every round. Reads in `onMounted` rather than
 * synchronously, same as `useWaitingListFlags.ts`, to avoid an SSR hydration
 * mismatch (a synchronous localStorage read makes the server-rendered
 * checkbox disagree with the client's real value, which Nuxt UI's checkbox
 * doesn't reliably repaint).
 */
export function useWinnerChecklist(eventId: number, round: MaybeRefOrGetter<number>) {
  const checked = ref<Record<number, boolean>>({})

  function load() {
    checked.value = getCached<Record<number, boolean>>(winnerChecklistKey(eventId, toValue(round)), CHECKLIST_TTL_MS) ?? {}
  }

  onMounted(load)
  watch(() => toValue(round), load)

  watch(checked, (value) => {
    setCached(winnerChecklistKey(eventId, toValue(round)), value)
  }, { deep: true })

  function toggle(playerId: number) {
    checked.value = { ...checked.value, [playerId]: !checked.value[playerId] }
  }

  return { checked, toggle }
}
