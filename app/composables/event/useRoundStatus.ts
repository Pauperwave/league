// app\composables\event\useRoundStatus.ts
import type { PairingWithResults, TablePlayer } from '#shared/utils/types'
import { getPairingPlayerIds } from '#shared/utils/types'

/** A single table row in the "Classifiche" or "Uccisioni" sections. */
export interface RoundStatusTableItem {
  pairingId: number
  tableIndex: number
  tableNumber: number
  done: boolean
  /** Seated players' "Nome Cognome" — not rendered, only searched against
   *  (see RoundStatusCard.vue's search bar) so typing a surname surfaces the
   *  table that player is seated at instead of matching nothing. */
  playerNames: string[]
}

/** A single player row in the "Comandanti" or "Voti" sections. */
export interface RoundStatusPlayerItem {
  pairingId: number
  playerId: number
  tableNumber: number
  name: string
  surname: string
  avatarUrl?: string
  done: boolean
}

/**
 * Derives the 4 round-status lists (rankings/kills per table, commanders/
 * votes per player) backing `RoundStatusCard.vue`, using the same completion
 * predicates as `PairingsCard.vue` (`useTableCompletion`) so the sidebar
 * summary and the table cards never disagree on what "done" means.
 */
export function useRoundStatus(
  pairings: Ref<PairingWithResults[]>,
  tournamentPlayers: Ref<TablePlayer[]>,
  rankingsStore: ReturnType<typeof useRankingsStore>,
  commandersStore: ReturnType<typeof useCommandersStore>,
  votesStore: ReturnType<typeof useVotesStore>,
) {
  const { hasRanking, hasKills } = useTableCompletion(rankingsStore, commandersStore, votesStore)

  const playersById = computed(() => new Map(tournamentPlayers.value.map(p => [p.id, p])))

  function seatedPlayerNames(pairing: PairingWithResults): string[] {
    return getPairingPlayerIds(pairing)
      .map(id => playersById.value.get(id))
      .filter((p): p is TablePlayer => !!p)
      .map(p => `${p.name} ${p.surname}`)
  }

  const rankingItems = computed<RoundStatusTableItem[]>(() =>
    pairings.value.map((pairing, index) => ({
      pairingId: pairing.pairing_id,
      tableIndex: index,
      tableNumber: index + 1,
      done: hasRanking(pairing),
      playerNames: seatedPlayerNames(pairing),
    })))

  const killItems = computed<RoundStatusTableItem[]>(() =>
    pairings.value.map((pairing, index) => ({
      pairingId: pairing.pairing_id,
      tableIndex: index,
      tableNumber: index + 1,
      done: hasKills(pairing),
      playerNames: seatedPlayerNames(pairing),
    })))

  function buildPlayerItems(isDone: (playerId: number) => boolean): RoundStatusPlayerItem[] {
    return pairings.value.flatMap((pairing, index) =>
      getPairingPlayerIds(pairing).map((playerId) => {
        const player = playersById.value.get(playerId)
        return {
          pairingId: pairing.pairing_id,
          playerId,
          tableNumber: index + 1,
          name: player?.name ?? '',
          surname: player?.surname ?? '',
          avatarUrl: player?.avatarUrl,
          done: isDone(playerId),
        }
      }))
  }

  const commanderItems = computed<RoundStatusPlayerItem[]>(() =>
    buildPlayerItems(playerId => commandersStore.getCommander1(playerId) !== null))

  const voteItems = computed<RoundStatusPlayerItem[]>(() =>
    buildPlayerItems(playerId => votesStore.hasVotes(playerId)))

  return { rankingItems, killItems, commanderItems, voteItems }
}
