<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { CellContext } from '@tanstack/vue-table'
import type { Pairing, TournamentPlayer } from '#shared/utils/types'

const {
  pairing = null,
  allPlayers,
  rankings = undefined,
  killsStore = undefined,
  votesStore = undefined,
} = defineProps<{
  pairing?: Pairing | null
  allPlayers: TournamentPlayer[]
  rankings?: ReturnType<typeof useRankingsStore>
  killsStore?: ReturnType<typeof useKillsStore>
  votesStore?: ReturnType<typeof useVotesStore>
}>()

const UIcon = resolveComponent('UIcon')

const pairingPlayers = computed(() => {
  if (!pairing) return []
  return [
    pairing.pairing_player1_id,
    pairing.pairing_player2_id,
    pairing.pairing_player3_id,
    pairing.pairing_player4_id,
  ]
    .filter((id): id is number => id !== null)
    .map((id) => allPlayers.find((p) => p.id === id))
    .filter((p): p is TournamentPlayer => !!p)
})

const getPlayerRank = (playerId: number): number | null => {
  if (!pairing) return null
  const ranking = rankings?.getRankingWithRanks(pairing.pairing_id)
  if (!ranking) return null
  const entry = ranking.find(entry => entry.playerId === playerId)
  return entry?.rank ?? null
}

const getPlacementPoints = (rank: number | null): number => {
  if (!rank) return 0
  return [3, 2, 1, 0][rank - 1] ?? 0
}

const getKillPoints = (playerId: number): number => {
  if (!killsStore || !pairing) return 0
  return killsStore.kills.filter((k) => k.killerId === playerId).length
}

const getDeckPoints = (playerId: number): number => {
  if (!votesStore || !pairing) return 0
  const playerIds = [
    pairing.pairing_player1_id,
    pairing.pairing_player2_id,
    pairing.pairing_player3_id,
    pairing.pairing_player4_id,
  ].filter((id): id is number => id !== null)

  return playerIds.filter((otherId) => {
    if (otherId === playerId) return false
    return votesStore!.getDeckVote(otherId) === playerId
  }).length
}

const getPlayPoints = (playerId: number): number => {
  if (!votesStore || !pairing) return 0
  const playerIds = [
    pairing.pairing_player1_id,
    pairing.pairing_player2_id,
    pairing.pairing_player3_id,
    pairing.pairing_player4_id,
  ].filter((id): id is number => id !== null)

  return playerIds.filter((otherId) => {
    if (otherId === playerId) return false
    return votesStore!.getPlayVote(otherId) === playerId
  }).length
}

type TableRow = {
  name: string
  placementPoints: number
  killPoints: number
  deckPoints: number
  playPoints: number
  total: number
}

const tableData = computed(() => {
  return pairingPlayers.value.map((player) => {
    const placementPoints = getPlacementPoints(getPlayerRank(player.id))
    const killPoints = getKillPoints(player.id)
    const deckPoints = getDeckPoints(player.id)
    const playPoints = getPlayPoints(player.id)
    return {
      name: `${player.name} ${player.surname}`,
      placementPoints,
      killPoints,
      deckPoints,
      playPoints,
      total: placementPoints + killPoints + deckPoints + playPoints,
    }
  })
})

const iconColumn = (
  accessorKey: keyof TableRow,
  icon: string,
  label: string,
  tdClass = 'text-center px-3 py-1.5'
): TableColumn<TableRow> => ({
  accessorKey,
  header: () =>
    h('div', { class: 'flex flex-col items-center gap-1' }, [
      h(UIcon, { name: icon, class: 'size-5' }),
      h('span', { class: 'text-xs' }, label),
    ]),
  cell: ({ getValue }: CellContext<TableRow, number>) => {
    const value = getValue()
    const isUnspecified = value === 0 && accessorKey !== 'total'
    return h(
      'span',
      { class: isUnspecified ? 'bg-warning/20 px-2 py-1 rounded' : 'px-2 py-1' },
      String(value)
    )
  },
  meta: { class: { th: 'text-center', td: tdClass } },
})

const columns: TableColumn<TableRow>[] = [
  {
    accessorKey: 'name',
    header: () =>
      h('div', { class: 'flex items-center gap-2' }, [
        h(UIcon, { name: 'i-lucide-user', class: 'size-5' }),
        h('span', 'Giocatore'),
      ]),
  },
  iconColumn('placementPoints', 'i-lucide-trophy', 'Posizionamento'),
  iconColumn('killPoints', 'i-lucide-skull', 'Uccisioni'),
  iconColumn('deckPoints', 'i-lucide-wand-2', 'Mazzo'),
  iconColumn('playPoints', 'i-lucide-gamepad-2', 'Giocata'),
  iconColumn('total', 'i-lucide-calculator', 'Totale', 'text-center px-3 py-1.5 font-bold'),
]
</script>

<template>
  <UTable
    :data="tableData"
    :columns="columns"
    :ui="{
      th: 'px-3 py-2 text-sm text-highlighted text-left font-semibold',
      td: 'px-3 py-1.5 text-sm text-muted whitespace-nowrap',
    }"
  />
</template>
