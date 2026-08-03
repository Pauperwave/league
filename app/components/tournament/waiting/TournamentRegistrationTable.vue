<!-- app\components\tournament\waiting\TournamentRegistrationTable.vue -->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Player, TournamentRegistration } from '#shared/utils/types'
import { UBadge } from '#components'
import PlayerNameTag from '~/components/player/PlayerNameTag.vue'

const { t } = useI18n()

const { registrations, players } = defineProps<{
  registrations: TournamentRegistration[]
  players: Player[]
}>()

const playersById = computed(() => new Map(players.map(p => [p.player_id, p])))

const unknownTimeLabel = t('tournament.registrationTable.unknownTime')
const paymentUnknownLabel = t('tournament.registrationTable.paymentUnknown')

interface RegistrationRow {
  index: number
  playerId: number
  name: string
  surname: string
  registeredAt: string
  paymentMethod: TournamentRegistration['paymentMethod']
}

const tableData = computed<RegistrationRow[]>(() =>
  registrations.map((registration, index) => {
    const player = playersById.value.get(registration.playerId)
    return {
      index: index + 1,
      playerId: registration.playerId,
      name: player?.player_name ?? t('league.ranking.playerFallback', { id: registration.playerId }),
      surname: player?.player_surname ?? '',
      registeredAt: formatRegisteredAt(registration.registeredAt, unknownTimeLabel),
      paymentMethod: registration.paymentMethod,
    }
  })
)

const columns = computed<TableColumn<RegistrationRow>[]>(() => [
  {
    accessorKey: 'index',
    header: '#',
    meta: { class: { th: 'w-10 text-right', td: 'w-10 text-right' } },
  },
  {
    accessorKey: 'name',
    header: t('tournament.registrationTable.playerColumn'),
    meta: { class: { td: 'font-medium' } },
    cell: ({ row }) => playerNameCell(PlayerNameTag, row.original),
  },
  {
    accessorKey: 'registeredAt',
    header: t('tournament.registrationTable.registeredAtColumn'),
    meta: { class: { th: 'text-center', td: 'text-center' } },
  },
  {
    id: 'paymentMethod',
    header: t('tournament.registrationTable.paymentColumn'),
    meta: { class: { th: 'text-center', td: 'text-center' } },
    cell: ({ row }) =>
      paymentMethodCell(UBadge, row.original.paymentMethod, paymentUnknownLabel, t),
  },
])
</script>

<template>
  <div class="w-full overflow-x-auto">
    <UTable
      :data="tableData"
      :columns="columns"
      sticky
      class="max-h-150"
      :ui="{
        root: 'border border-default',
        base: 'overflow-clip',
        th: 'border-b border-default py-2',
        td: 'border-b border-default py-1',
      }"
    >
      <template #empty>
        <UEmpty
          :title="t('tournament.registrationTable.emptyTitle')"
          :icon="ICONS.players"
        />
      </template>
    </UTable>
  </div>
</template>
