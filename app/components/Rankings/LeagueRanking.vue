<!-- app\components\Rankings\LeagueRanking.vue -->
<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { StandingWithPlayer } from '#shared/utils/types'

interface Props {
  standings: StandingWithPlayer[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false
})

const TOP_SPOTS = 8

const rowClass = (row: TableRow<StandingWithPlayer>): string => {
  const i = row.index
  const classes: string[] = []
  const isTop = i < TOP_SPOTS

  if (i === 0) classes.push('border-t-2 border-dashed border-primary/40')
  if (i === TOP_SPOTS - 1) classes.push('border-b-2 border-dashed border-primary/40')

  if (isTop) classes.push('bg-primary/10 hover:bg-primary/15')
  else classes.push('hover:bg-muted/40')

  return classes.join(' ')
}

const tableMeta = {
  class: { tr: rowClass }
}

const columns: TableColumn<StandingWithPlayer>[] = [
  {
    id: 'rank',
    header: '#',
    meta: { class: { th: 'w-12 text-center', td: 'text-center p-0' } },
    cell: ({ row }) => {
      const i = row.index
      const isTop = i < TOP_SPOTS

      const badge = h(
        'span',
        {
          class: [
            'inline-flex items-center justify-center size-6 rounded-full text-xs font-bold tabular-nums',
            isTop ? 'bg-primary text-black' : 'text-muted'
          ].join(' ')
        },
        String(i + 1)
      )

      return h(
        'div',
        {
          class: [
            'flex items-center justify-center px-4 py-3',
            isTop ? 'border-l-2 border-dashed border-primary/40' : ''
          ].join(' ')
        },
        [badge]
      )
    }
  },
  {
    id: 'player',
    header: 'Giocatore',
    cell: ({ row }) => {
      const name = row.original.players?.player_name ?? `Giocatore ${row.original.player_id}`
      const surname = row.original.players?.player_surname ?? ''

      return h('span', { class: 'font-medium text-default' }, [
        name,
        surname
          ? h(
            'span',
            { class: 'font-bold text-primary' },
            ` ${surname}`
          )
          : null
      ])
    }
  },
  {
    accessorKey: 'standing_player_score',
    header: 'Punti',
    meta: { class: { th: 'text-right', td: 'text-right p-0' } },
    cell: ({ row }) => {
      const score = row.original.standing_player_score ?? 0
      const i = row.index
      const isTop = i < TOP_SPOTS

      const label = h(
        'span',
        { class: isTop ? 'font-bold text-primary-foreground' : 'font-medium' },
        `${score} PT`
      )

      return h(
        'div',
        {
          class: [
            'flex items-center justify-end px-4 py-3',
            isTop ? 'border-r-2 border-dashed border-primary/40' : ''
          ].join(' ')
        },
        [label]
      )
    }
  }
]
</script>

<template>
  <div class="overflow-hidden border border-default rounded-none">
    <UTable
:data="standings" :columns="columns" :meta="tableMeta" :loading="loading" class="w-full" :ui="{
      thead: 'hidden',
      td: 'border-b border-default px-4 py-3 text-sm whitespace-nowrap',
      tbody: '[&>tr:last-child>td]:border-0'
    }">
      <template #empty>
        <div class="flex flex-col items-center gap-2 py-12 text-muted">
          <LazyUIcon name="i-lucide-trophy" class="size-10 opacity-30" />
          <p class="text-sm">
            Nessun punteggio disponibile
          </p>
        </div>
      </template>
    </UTable>
  </div>
</template>
