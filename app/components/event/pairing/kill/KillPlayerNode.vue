<!-- app\components\event\pairing\kill\KillPlayerNode.vue -->
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { NodeToolbar } from '@vue-flow/node-toolbar'
import type { TournamentPlayer } from '#shared/utils/types'
import type { PlayerColor } from '~/utils/playerColor'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  // fallow-ignore-next-line unused-component-props -- required by Vue Flow's node component contract, always passed even though this component keys off data.player.id instead
  id: string
  data: {
    player: TournamentPlayer
    width: string
    color: PlayerColor
  }
  selected: boolean
}>()

const killsStore = useKillsStore()
const { t } = useI18n()

const killCount = computed(() =>
  killsStore.killsByKiller(props.data.player.id).length,
)
const deathCount = computed(() =>
  killsStore.deathsByVictim(props.data.player.id),
)
const hasSuicided = computed(() =>
  killsStore.hasSuicided(props.data.player.id),
)
const hasStats = computed(() => killCount.value > 0 || deathCount.value > 0 || hasSuicided.value)
</script>

<template>
  <!-- Kill/death/suicide counters — floats above the node instead of taking
       up card space, so it doesn't compete with the fixed node width. -->
  <NodeToolbar
    :node-id="id"
    :is-visible="hasStats"
    :position="Position.Top"
    :offset="8"
  >
    <div class="flex items-center gap-1 rounded-lg border border-default bg-elevated px-2 py-1 shadow-sm">
      <UTooltip v-if="killCount > 0" :content="{ side: 'top' }" :text="t('event.killFlow.killCountTooltip', { count: killCount })">
        <UBadge
          :icon="ICONS.ruleKill"
          :label="String(killCount)"
          :color="data.color"
          variant="solid"
        />
      </UTooltip>
      <UTooltip v-if="hasSuicided" :content="{ side: 'top' }" :text="t('event.killFlow.suicideTooltip')">
        <UBadge
          :icon="ICONS.refresh"
          color="warning"
          variant="solid"
        />
      </UTooltip>
      <!-- Neutral, not per-player: aggregates kills from potentially several
           differently-colored killers, so no single accent color applies.
           `solid`, not `soft` — Nuxt UI's neutral+soft combo maps to
           `text-default` (the app's near-black body text), which read as a
           near-invisible icon; `solid` maps to `text-inverted` instead. -->
      <UTooltip v-if="deathCount > 0" :content="{ side: 'top' }" :text="t('event.killFlow.deathCountTooltip', { count: deathCount })">
        <UBadge
          :icon="ICONS.kills"
          :label="String(deathCount)"
          color="neutral"
          variant="solid"
        />
      </UTooltip>
    </div>
  </NodeToolbar>

  <!-- SOURCE handle: the arrow starts here (killer) -->
  <Handle
    id="source"
    type="source"
    :position="Position.Bottom"
    class="w-3! h-3! bg-error-500! border-2! border-white!"
  />

  <div
    class="rounded-lg border-2 bg-default shadow-sm transition-all duration-150"
    :class="[
      selected
        ? 'border-primary-500 shadow-primary-500/20 shadow-lg'
        : 'border-default hover:border-muted',
    ]"
    :style="{ width: data.width }"
  >
    <!-- Chip content -->
    <div class="flex items-center gap-2 px-2 py-2">
      <UAvatar
        :src="data.player.avatarUrl"
        :alt="`${data.player.name} ${data.player.surname}`"
      />
      <div class="min-w-0">
        <p class="text-xs font-semibold whitespace-nowrap">
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
