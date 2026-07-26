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
  <!-- Always rendered (opacity-toggled, not v-if) so this block reserves its
       exact footprint — mt-4 + p-4 + a w-64 card at its real 5:7 aspect
       ratio (358px tall) — whether or not a card is selected yet, instead of
       the modal jumping in height the moment a commander gets picked. -->
  <div
    class="mt-4 p-4 rounded-lg shadow-lg flex gap-4 justify-center transition-opacity"
    :class="[colorBgClass, card ? 'opacity-100' : 'opacity-0 pointer-events-none']"
  >
    <div class="w-64 aspect-5/7">
      <NuxtImg
        v-if="frontImage"
        :src="frontImage"
        :alt="card?.name"
        class="size-full rounded-lg shadow-xl object-cover"
        loading="lazy"
      />
    </div>
    <div v-if="isDoubleFaced" class="w-64 aspect-5/7">
      <NuxtImg
        v-if="backImage"
        :src="backImage"
        :alt="(card?.name ?? '') + ' (back)'"
        class="size-full rounded-lg shadow-xl object-cover"
        loading="lazy"
      />
    </div>
  </div>
</template>
