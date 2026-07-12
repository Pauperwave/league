<!-- app\components\CardPreview.vue -->
<script setup lang="ts">
import { computed, watch } from 'vue'
import type { CommanderCard } from '~/composables/commanders/useCommanderCards'

const props = defineProps<{
  card: CommanderCard | null
}>()

const COLOR_MAP: Record<string, string> = {
  W: 'amber-100',
  U: 'blue-600',
  B: 'gray-950',
  R: 'red-600',
  G: 'green-600',
  C: 'gray-300',
}

/**
 * Extracts colors from a mana cost
 */
function extractColorsFromManaCost(costString: string): Set<string> {
  const colors = new Set<string>()
  const matches = costString.match(/{([^}]*)}/g) || []

  matches.forEach((mana) => {
    const content = mana.replace(/[{}]/g, '')
    for (const c of content) {
      if ('WUBRGC'.includes(c) && c !== 'P') {
        colors.add(c)
      }
    }
  })

  return colors
}

function resolveCardColors(card: CommanderCard): string[] {
  const colors = new Set<string>()

  if (card.manaCost) {
    extractColorsFromManaCost(card.manaCost).forEach(c => colors.add(c))
  }

  if (card.isDoubleFaced && card.backManaCost) {
    extractColorsFromManaCost(card.backManaCost).forEach(c => colors.add(c))
  }

  if (colors.size === 0 && card.colorIdentity?.length) {
    card.colorIdentity.forEach(c => colors.add(c))
  }

  if (colors.size === 0) return ['C']
  return Array.from(colors)
}

function buildGradientClass(colors: string[]): string {
  if (colors.length > 3) {
    return 'bg-gradient-to-br from-amber-200 via-amber-200 to-transparent'
  }

  if (colors.length === 3) {
    const [from, via, to] = colors.map(c => COLOR_MAP[c] || COLOR_MAP.C)
    return `bg-gradient-to-r from-${from} via-${via} to-${to}`
  }

  if (colors.length === 2) {
    const [from, to] = colors.map(c => COLOR_MAP[c] || COLOR_MAP.C)
    return `bg-gradient-to-br from-${from} to-${to}`
  }

  const color = COLOR_MAP[colors[0]!] || COLOR_MAP.C
  return `bg-gradient-to-br from-${color} via-${color} to-transparent`
}

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
    console.log('[CardPreview] 🖼️ Card displayed:', newCard.name)
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
