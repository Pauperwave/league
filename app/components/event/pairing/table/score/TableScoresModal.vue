<!-- app\components\event\pairing\table\score\TableScoresModal.vue -->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { CellContext } from '@tanstack/vue-table'
import { calculatePlayerTableScore } from '#shared/utils/roundScoring'
import type { PairingWithResults, RoundResult, Ruleset, TournamentPlayer } from '#shared/utils/types'
import PlayerNameTag from '~/components/player/PlayerNameTag.vue'

const { t } = useI18n()

const {
  pairing = null,
  allPlayers,
  ruleset = null,
} = defineProps<{
  pairing?: PairingWithResults | null
  allPlayers: TournamentPlayer[]
  ruleset?: Ruleset | null
}>()

const UIcon = resolveComponent('UIcon')

const posValues = computed(() => [
  0,
  ruleset?.rule_set_rank1 ?? 0,
  ruleset?.rule_set_rank2 ?? 0,
  ruleset?.rule_set_rank3 ?? 0,
  ruleset?.rule_set_rank4 ?? 0,
])

const tableResults = computed<RoundResult[]>(() => pairing?.round_results ?? [])

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

/** All seated player ids except the given one — used to check whether every
 *  *other* player has cast a vote yet (a player's deck/play points are the
 *  sum of votes cast by others, so it's "unspecified" until all others have
 *  submitted, not until this player's own row exists). */
function getOtherPlayerIds(playerId: number): number[] {
  if (!pairing) return []
  return [
    pairing.pairing_player1_id,
    pairing.pairing_player2_id,
    pairing.pairing_player3_id,
    pairing.pairing_player4_id,
  ].filter((id): id is number => id !== null && id !== playerId)
}

/** A vote is "cast" once the player's round_results row has either field set
 *  — null in both means they haven't visited the votes modal yet, not that
 *  they explicitly abstained on both (same convention as votesStore.hasVotes
 *  / buildStandingsSubmissionMap). */
function hasCastVotes(playerId: number): boolean {
  const result = tableResults.value.find(r => r.player_id === playerId)
  return !!result && (result.brew_vote !== null || result.play_vote_1 !== null)
}

type TableRow = {
  playerId: number
  name: string
  surname: string
  placementPoints: number
  placementUnspecified: boolean
  killPoints: number
  killUnspecified: boolean
  deckPoints: number
  deckUnspecified: boolean
  playPoints: number
  playUnspecified: boolean
  total: number
}

const tableData = computed<TableRow[]>(() => {
  return pairingPlayers.value.map((player) => {
    const myResult = tableResults.value.find(r => r.player_id === player.id)
    const scored = calculatePlayerTableScore(player.id, tableResults.value, posValues.value, ruleset)
    const otherIds = getOtherPlayerIds(player.id)

    return {
      playerId: player.id,
      name: player.name,
      surname: player.surname,
      placementPoints: scored?.scoreRank ?? 0,
      placementUnspecified: (myResult?.position ?? null) === null,
      killPoints: scored?.killScore ?? 0,
      killUnspecified: (myResult?.number_of_kills ?? null) === null,
      deckPoints: scored?.brewScore ?? 0,
      deckUnspecified: otherIds.some(id => !hasCastVotes(id)),
      playPoints: scored?.playScore ?? 0,
      playUnspecified: otherIds.some(id => !hasCastVotes(id)),
      total: scored?.totalScore ?? 0,
    }
  })
})

const iconColumn = (
  accessorKey: keyof TableRow,
  unspecifiedKey: keyof TableRow | null,
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
  cell: ({ row, getValue }: CellContext<TableRow, number>) => {
    const value = getValue()
    const isUnspecified = unspecifiedKey !== null && !!row.original[unspecifiedKey]
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
        h(UIcon, { name: ICONS.player, class: 'size-5' }),
        h('span', t('league.ranking.player')),
      ]),
    cell: ({ row }) => h(PlayerNameTag, {
      name: row.original.name,
      surname: row.original.surname,
      playerId: row.original.playerId,
      avatarSize: 'xs',
    }),
  },
  iconColumn('placementPoints', 'placementUnspecified', ICONS.standings, t('event.tableScoresModal.placementColumn')),
  iconColumn('killPoints', 'killUnspecified', ICONS.kills, t('player.stats.kills')),
  iconColumn('deckPoints', 'deckUnspecified', ICONS.generate, t('event.tableScoresModal.deckColumn')),
  iconColumn('playPoints', 'playUnspecified', ICONS.gameplay, t('event.tableScoresModal.playColumn')),
  iconColumn('total', null, ICONS.total, t('event.scoreBreakdown.playerTotal'), 'text-center px-3 py-1.5 font-bold'),
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
