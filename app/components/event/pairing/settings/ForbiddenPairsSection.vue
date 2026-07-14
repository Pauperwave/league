<!-- app\components\event\pairing\settings\ForbiddenPairsSection.vue -->
<script setup lang="ts">

const { t } = useI18n()

interface ForbiddenPair {
  playerA: number
  playerB: number
}

interface Player {
  id: number
  name: string
}

const props = defineProps<{
  forbiddenPairs: ForbiddenPair[]
  allPlayers: Player[]
  eventId: number
}>()

const emit = defineEmits<{
  addPair: []
  resolveConflicts: []
  removePair: [playerA: number, playerB: number]
}>()

const pairPlayerA = defineModel<string>('pairPlayerA', { default: '' })
const pairPlayerB = defineModel<string>('pairPlayerB', { default: '' })

const playerOptions = usePlayerOptions(() => props.allPlayers.map(p => ({
  player_id: p.id,
  player_name: p.name,
  formats_played: null,
  is_active: true,
  player_surname: '',
})))

const canAddForbiddenPair = computed(() => {
  if (!pairPlayerA.value || !pairPlayerB.value) return false
  return pairPlayerA.value !== pairPlayerB.value
})

const pairingStorageKey = computed(() => `pairing-preferences-event-${props.eventId}`)

const forbiddenPairsDisplay = computed(() => {
  const playerMap = new Map(props.allPlayers.map(player => [player.id, player.name]))
  return props.forbiddenPairs.map(pair => ({
    key: getForbiddenPairKey(pair.playerA, pair.playerB),
    playerA: pair.playerA,
    playerB: pair.playerB,
    label: `${playerMap.get(pair.playerA) ?? t('league.ranking.playerFallback', { id: pair.playerA })} — ${playerMap.get(pair.playerB) ?? t('league.ranking.playerFallback', { id: pair.playerB })}`,
  }))
})
</script>

<template>
  <section class="space-y-3">
    <div class="text-sm font-semibold">{{ t('event.forbiddenPairs.heading') }}</div>

    <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
      <USelectMenu
        v-model="pairPlayerA"
        :items="playerOptions"
        value-key="value"
        :placeholder="t('event.forbiddenPairs.playerAPlaceholder')"
        :search-input="{ placeholder: t('event.forbiddenPairs.searchPlaceholder') }"
      />

      <USelectMenu
        v-model="pairPlayerB"
        :items="playerOptions"
        value-key="value"
        :placeholder="t('event.forbiddenPairs.playerBPlaceholder')"
        :search-input="{ placeholder: t('event.forbiddenPairs.searchPlaceholder') }"
      />

      <UButton
        color="neutral"
        variant="soft"
        :icon="ICONS.add"
        :disabled="!canAddForbiddenPair"
        @click="emit('addPair')"
      >
        {{ t('event.forbiddenPairs.addPair') }}
      </UButton>

      <UButton
        color="warning"
        variant="outline"
        :icon="ICONS.refresh"
        @click="emit('resolveConflicts')"
      >
        {{ t('event.forbiddenPairs.resolveConflicts') }}
      </UButton>
    </div>

    <div class="max-h-48 overflow-auto space-y-1 pr-1">
      <div v-if="!forbiddenPairsDisplay.length" class="text-sm text-muted">
        {{ t('event.forbiddenPairs.empty') }}
      </div>

      <div
        v-for="pair in forbiddenPairsDisplay"
        :key="pair.key"
        class="flex items-center justify-between rounded border border-default/70 bg-muted/20 px-2 py-1.5"
      >
        <span class="text-sm">{{ pair.label }}</span>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          :icon="ICONS.delete"
          @click="emit('removePair', pair.playerA, pair.playerB)"
        />
      </div>
    </div>

    <div class="text-xs text-muted">
      {{ t('event.forbiddenPairs.storageNote') }}
      <code>{{ pairingStorageKey }}</code>.
    </div>
  </section>
</template>
