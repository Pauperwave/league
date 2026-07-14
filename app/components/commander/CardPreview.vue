<!-- app\components\commander\CardPreview.vue -->
<script setup lang="ts">
import type { CommanderCard } from '~/composables/commanders/useCommanderCards'

const props = defineProps<{
  card: CommanderCard | null
}>()

const isDoubleFaced = computed(() => props.card?.isDoubleFaced ?? false)

const colorBgClass = computed(() => {
  if (!props.card) return ''
  return buildGradientClass(resolveCardColors(props.card))
})

const frontImage = computed(() => props.card?.largeImageUrl ?? null)

const backImage = computed(() => {
  if (!isDoubleFaced.value) return null
  return props.card?.backLargeImageUrl ?? null
})

// Logging when the card changes
watch(() => props.card, (newCard) => {
  if (newCard) {
    logDebug('CardPreview', '🖼️ Card displayed:', newCard.name)
  }
}, { immediate: true })
</script>

<template>
  <div
    v-if="card"
    class="mt-4 p-4 rounded-lg shadow-lg flex gap-4 justify-center"
    :class="colorBgClass"
  >
    <NuxtImg
      v-if="frontImage"
      :src="frontImage"
      :alt="card.name"
      class="w-64 rounded-lg shadow-xl"
      loading="lazy"
    />
    <NuxtImg
      v-if="backImage"
      :src="backImage"
      :alt="card.name + ' (back)'"
      class="w-64 rounded-lg shadow-xl"
      loading="lazy"
    />
  </div>
</template>
