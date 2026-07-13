<!-- app\components\player\PlayerCard.vue -->
<script setup lang="ts">
import type { Player } from '#shared/utils/types'
import { slugify } from '~/utils/slug'

const props = defineProps<{
  player: Player
  statLabel?: string
  statValue?: string
}>()

const slug = computed(() =>
  slugify(`${props.player.player_name ?? ''} ${props.player.player_surname ?? ''}`.trim())
)
</script>

<template>
  <NuxtLink
    :to="`/player/${slug}`"
    class="flex items-center gap-3 p-4 bg-elevated rounded-lg border border-default hover:border-primary hover:shadow-md transition-all"
  >
    <UAvatar size="md" :text="player.player_name?.charAt(0).toUpperCase() ?? '?'" />
    <div class="flex-1">
      <p class="font-medium">
        {{ player.player_name }}
        <span class="font-bold text-primary">{{ player.player_surname }}</span>
      </p>
      <p v-if="statLabel && statValue !== undefined" class="text-xs text-muted mt-0.5">
        {{ statLabel }}: <span class="font-semibold text-default">{{ statValue }}</span>
      </p>
    </div>
    <PlayerDeckCount :player-id="player.player_id" />
  </NuxtLink>
</template>
