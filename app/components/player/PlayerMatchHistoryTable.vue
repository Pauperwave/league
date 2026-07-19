<!-- app\components\player\PlayerMatchHistoryTable.vue -->
<script setup lang="ts">
import type { PlayerMatchHistory } from '~/composables/players/usePlayerMatchHistory'

interface Props {
  matchHistory: PlayerMatchHistory[]
}

const { matchHistory } = defineProps<Props>()

const { t } = useI18n()

function formatMatchDate(pairingDatetime: string): string {
  return new Date(pairingDatetime).toLocaleDateString('it-IT')
}

// A row gets a divider above it only when its date differs from the
// previous row's — matchHistory is already sorted newest-first (see
// usePlayerMatchHistory.ts), so same-day matches render as one visual group
// instead of every row carrying its own border.
const rows = computed(() =>
  matchHistory.map((match, index) => ({
    match,
    isNewDateGroup: index === 0 || formatMatchDate(match.pairing_datetime) !== formatMatchDate(matchHistory[index - 1]!.pairing_datetime),
  }))
)
</script>

<template>
  <div class="bg-elevated rounded-xl p-6 border border-default shadow-lg">
    <div class="flex items-center gap-2 mb-4">
      <UIcon :name="ICONS.battle" class="size-5 text-primary" />
      <h2 class="text-lg font-bold">{{ t('player.matchHistory.heading') }}</h2>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-accented">
            <th class="text-left py-2 px-3 text-muted font-medium">{{ t('player.matchHistory.date') }}</th>
            <th class="text-left py-2 px-3 text-muted font-medium">{{ t('player.matchHistory.event') }}</th>
            <th class="text-center py-2 px-3 text-muted font-medium">{{ t('player.matchHistory.round') }}</th>
            <th class="text-center py-2 px-3 text-muted font-medium">{{ t('player.matchHistory.table') }}</th>
            <th class="text-left py-2 px-3 text-muted font-medium">{{ t('player.matchHistory.commander') }}</th>
            <th class="text-center py-2 px-3 text-muted font-medium">{{ t('player.matchHistory.position') }}</th>
            <th class="text-center py-2 px-3 text-muted font-medium">{{ t('player.matchHistory.kills') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="{ match, isNewDateGroup } in rows"
            :key="match.pairing_id"
            class="hover:bg-elevated/50 transition-colors"
            :class="isNewDateGroup ? '[&>td]:border-t [&>td]:border-accented' : ''"
          >
            <td class="py-2 px-3 text-muted">
              {{ formatMatchDate(match.pairing_datetime) }}
            </td>
            <td class="py-2 px-3">
              <NuxtLink
                :to="`/league/${match.league_id}/event/${match.event_id}`"
                class="text-primary hover:underline"
              >
                {{ match.event_name }}
              </NuxtLink>
            </td>
            <td class="text-center py-2 px-3">{{ match.pairing_round }}</td>
            <td class="text-center py-2 px-3">{{ match.table_number }}</td>
            <td class="py-2 px-3">
              <div class="flex items-center gap-1">
                <span>{{ match.commander_1 ?? '—' }}</span>
                <span v-if="match.commander_2" class="text-muted">+ {{ match.commander_2 }}</span>
              </div>
            </td>
            <td class="text-center py-2 px-3">{{ match.position }}</td>
            <td class="text-center py-2 px-3">{{ match.number_of_kills }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
