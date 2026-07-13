<!-- app\components\event\pairing\kill\KillPlayerNode.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
import { Handle, Position } from '@vue-flow/core'
import type { TournamentPlayer } from '#shared/utils/types'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  // fallow-ignore-next-line unused-component-props -- required by Vue Flow's node component contract, always passed even though this component keys off data.player.id instead
  id: string
  data: { player: TournamentPlayer }
  selected: boolean
}>()

const killsStore = useKillsStore()

const killCount = computed(() =>
  killsStore.killsByKiller(props.data.player.id).length,
)
const deathCount = computed(() =>
  killsStore.deathsByVictim(props.data.player.id),
)
const hasSuicided = computed(() =>
  killsStore.hasSuicided(props.data.player.id),
)
</script>

<template>
  <!-- SOURCE handle: the arrow starts here (killer) -->
  <Handle
    id="source"
    type="source"
    :position="Position.Bottom"
    class="w-3! h-3! bg-error-500! border-2! border-white!"
  />

  <div
    class="rounded-lg border-2 bg-default shadow-sm transition-all duration-150 min-w-36"
    :class="[
      selected
        ? 'border-primary-500 shadow-primary-500/20 shadow-lg'
        : 'border-default hover:border-muted',
    ]"
  >
    <!-- Kill/death counters -->
    <div class="flex justify-between px-2 pt-1 min-h-4">
      <div class="flex gap-1">
        <UBadge
          v-if="killCount > 0"
          :label="`⚔ ${killCount}`"
          color="error"
          variant="solid"
          size="xs"
        />
        <UBadge
          v-if="hasSuicided"
          :icon="ICONS.refresh"
          color="warning"
          variant="solid"
          size="xs"
        />
      </div>
      <UBadge
        v-if="deathCount > 0"
        :label="`💀 ${deathCount}`"
        color="neutral"
        variant="soft"
        size="xs"
        class="ml-auto"
      />
    </div>

    <!-- Chip content -->
    <div class="flex items-center gap-2 px-2 pb-2 pt-1">
      <UAvatar
        :src="data.player.avatarUrl"
        :alt="`${data.player.name} ${data.player.surname}`"
      />
      <div class="min-w-0">
        <p class="text-xs font-semibold truncate">
          {{ data.player.name }} {{ data.player.surname }}
        </p>
        <p class="text-xs text-muted">#{{ data.player.id }}</p>
      </div>
    </div>
  </div>

  <!-- TARGET handle: the arrow arrives here (victim) -->
  <Handle
    id="target"
    type="target"
    :position="Position.Top"
    class="w-3! h-3! bg-neutral-400! border-2! border-white!"
  />
</template>
