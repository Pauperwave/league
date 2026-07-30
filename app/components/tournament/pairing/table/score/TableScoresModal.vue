<!-- app\components\tournament\pairing\table\score\TableScoresModal.vue -->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { CellContext } from '@tanstack/vue-table'
import type { TableScoreRow } from '~/utils/tableScoreRows'
import type { PairingWithResults, Ruleset, TablePlayer } from '#shared/utils/types'
import PlayerNameTag from '~/components/player/PlayerNameTag.vue'

const { t } = useI18n()

const {
  pairing = null,
  allPlayers,
  ruleset = null,
} = defineProps<{
  pairing?: PairingWithResults | null
  allPlayers: TablePlayer[]
  ruleset?: Ruleset | null
}>()

const UIcon = resolveComponent('UIcon')

const tableData = computed(() => buildTableScoreRows(pairing, allPlayers, ruleset))

const iconColumn = (
  accessorKey: keyof TableScoreRow,
  unspecifiedKey: keyof TableScoreRow | null,
  icon: string,
  label: string,
  tdClass = 'text-center px-3 py-1.5'
): TableColumn<TableScoreRow> => ({
  accessorKey,
  header: () =>
    h('div', { class: 'flex flex-col items-center gap-1' }, [
      h(UIcon, { name: icon, class: 'size-5' }),
      h('span', { class: 'text-xs' }, label),
    ]),
  cell: ({ row, getValue }: CellContext<TableScoreRow, number>) => {
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

const columns: TableColumn<TableScoreRow>[] = [
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
