<!-- app\components\tournament\waiting\LastTournamentParticipantsTable.vue -->
<!-- Standalone table (not just a chip row) on purpose — this is expected to
     grow columns later (pre-registration status, payment method carried over,
     etc.), so it gets its own table shell from the start instead of a quick
     inline list that would need redoing. -->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Component } from 'vue'
import type { Player } from '#shared/utils/types'
import PlayerNameTag from '~/components/player/PlayerNameTag.vue'

const { tournamentName, players, waitingPlayers } = defineProps<{
  tournamentName: string
  players: Player[]
  waitingPlayers: number[]
}>()

const emit = defineEmits<{
  add: [playerId: number]
}>()

const { t } = useI18n()

const addedCount = computed(() => players.filter(p => waitingPlayers.includes(p.player_id)).length)

// Green/yellow/red gauge on the return-rate of last tappa's participants —
// gives the organizer a glance at whether recruitment is going well without
// having to read the actual table rows.
const addedRatio = computed(() => (players.length > 0 ? addedCount.value / players.length : 0))
const addedBadgeColor = computed(() => {
  if (addedRatio.value >= 2 / 3) return 'success'
  if (addedRatio.value >= 1 / 3) return 'warning'
  return 'error'
})

const UButton = resolveComponent('UButton') as Component

const columns = computed<TableColumn<Player>[]>(() => [
  {
    accessorKey: 'player_name',
    header: t('tournament.waitingListTable.playerColumn'),
    cell: ({ row }) => h(PlayerNameTag, {
      name: row.original.player_name,
      surname: row.original.player_surname,
      playerId: row.original.player_id,
      avatarSize: 'md',
      muted: waitingPlayers.includes(row.original.player_id),
    }),
  },
  {
    id: 'actions',
    header: t('tournament.waitingListTable.actionsColumn'),
    meta: { class: { th: 'text-center', td: 'text-center' } },
    cell: ({ row }) => {
      const alreadyAdded = waitingPlayers.includes(row.original.player_id)
      return h(UButton, {
        size: 'xs',
        color: alreadyAdded ? 'success' : 'primary',
        variant: alreadyAdded ? 'subtle' : 'soft',
        icon: alreadyAdded ? ICONS.success : ICONS.addPlayer,
        disabled: alreadyAdded,
        label: alreadyAdded
          ? t('tournament.waitingList.alreadyAddedFromLastTournament')
          : t('tournament.waitingList.addFromLastTournament'),
        onClick: () => emit('add', row.original.player_id),
      })
    },
  },
])
</script>

<template>
  <div class="bg-muted/30 rounded-lg p-4 space-y-4">
    <h2 class="font-semibold text-xl flex items-center gap-2">
      <UIcon :name="ICONS.players" size="lg" class="text-muted" />
      {{ t('tournament.waitingList.lastTournamentHeading', { name: tournamentName }) }}
      <UBadge
        :color="addedBadgeColor"
        variant="subtle"
        size="lg"
        :ui="{ base: 'px-2.5 py-1.5 text-sm font-medium' }"
      >
        {{ addedCount }}/{{ players.length }}
      </UBadge>
    </h2>
    <div class="w-full overflow-x-auto">
      <UTable
        :data="players"
        :columns="columns"
        sticky
        class="max-h-200"
        :ui="{
          root: 'border border-default',
          base: 'overflow-clip',
          th: 'border-b border-default py-2',
          td: 'border-b border-default py-1',
        }"
        :get-row-id="(row) => String(row.player_id)"
      >
        <template #empty>
          <UEmpty
            :title="t('tournament.waitingList.lastTournamentEmptyTitle')"
            :description="t('tournament.waitingList.lastTournamentEmptyDescription')"
            :icon="ICONS.players"
          />
        </template>
      </UTable>
    </div>
  </div>
</template>
