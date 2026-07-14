<!-- app\components\player\PlayerMatchHistoryTable.vue -->
<script setup lang="ts">
import type { PlayerMatchHistory } from '~/composables/players/usePlayerMatchHistory'

interface Props {
  matchHistory: PlayerMatchHistory[]
}

defineProps<Props>()

const { t } = useI18n()
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
          <tr class="border-b border-default">
            <th class="text-left py-2 px-3 text-muted font-medium">{{ t('player.matchHistory.event') }}</th>
            <th class="text-center py-2 px-3 text-muted font-medium">{{ t('player.matchHistory.round') }}</th>
            <th class="text-center py-2 px-3 text-muted font-medium">{{ t('player.matchHistory.table') }}</th>
            <th class="text-left py-2 px-3 text-muted font-medium">{{ t('player.matchHistory.commander') }}</th>
            <th class="text-center py-2 px-3 text-muted font-medium">{{ t('player.matchHistory.position') }}</th>
            <th class="text-center py-2 px-3 text-muted font-medium">{{ t('player.matchHistory.kills') }}</th>
            <th class="text-right py-2 px-3 text-muted font-medium">{{ t('player.matchHistory.date') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="match in matchHistory"
            :key="match.pairing_id"
            class="border-b border-default/50 hover:bg-elevated/50 transition-colors"
          >
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
            <td class="text-center py-2 px-3">
              <UBadge
                :color="match.position === 1 ? 'warning' : 'neutral'"
                variant="soft"
                size="xs"
              >
                {{ match.position }}°
              </UBadge>
            </td>
            <td class="text-center py-2 px-3">{{ match.number_of_kills }}</td>
            <td class="text-right py-2 px-3 text-muted">
              {{ new Date(match.pairing_datetime).toLocaleDateString('it-IT') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
