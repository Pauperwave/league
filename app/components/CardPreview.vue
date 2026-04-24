<script setup lang="ts">
import { computed } from 'vue'

interface CardFace {
  name?: string
  mana_cost?: string
  colors?: string[]
  image_uris?: {
    large?: string
  }
}

interface ScryfallCard {
  id?: string
  name: string
  mana_cost?: string
  color_identity?: string[]
  card_faces?: CardFace[]
  image_uris?: {
    large?: string
  }
}

interface Props {
  card: ScryfallCard | null
}

const props = defineProps<Props>()

/**
 * Estrae i colori dal costo di mana
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

const isDoubleFaced = computed(() => {
  return props.card?.card_faces && props.card.card_faces.length > 1
})

const isColorless = computed(() => {
  return !props.card?.color_identity?.length
})

/**
 * Genera le classi CSS per il background colorato
 */
const colorBgClass = computed(() => {
  if (!props.card) return ''

  const colorMap: Record<string, string> = {
    W: 'amber-100',
    U: 'blue-600',
    B: 'gray-950',
    R: 'red-600',
    G: 'green-600',
    C: 'gray-300',
  }

  // Se la carta è incolore
  if (isColorless.value) {
    return `bg-gradient-to-br from-${colorMap.C} via-${colorMap.C} to-transparent`
  }

  let extractedColors = new Set<string>()

  // Se la carta ha più facce
  if (props.card.card_faces) {
    console.log('[CardPreview] 📢 Carta con più facce rilevata:', props.card.name)

    const manaCosts = props.card.card_faces.map(face => face.mana_cost).join('')
    const colorIdentity = props.card.color_identity || []
    const cardColors = [...new Set(props.card.card_faces.map(face => face.colors || []).flat().filter((c): c is string => !!c))]
    const retroCardHasManaCost = props.card.card_faces[1]?.mana_cost !== ''

    console.log('[CardPreview] Dettagli carta:', {
      'Costi di Mana': manaCosts,
      'Identità Colore': colorIdentity,
      'Colori Carta': cardColors,
      'Carta Retro Ha Costo Mana': retroCardHasManaCost,
    })

    const frontColors = extractColorsFromManaCost(props.card.card_faces[0]?.mana_cost || '')
    const backColors = extractColorsFromManaCost(props.card.card_faces[1]?.mana_cost || '')

    if (backColors.size === 0 && props.card.card_faces[1]?.colors) {
      console.log(`[CardPreview] Retro "${props.card.card_faces[1]?.name}" non ha costo di mana`)
      props.card.card_faces[1]?.colors?.forEach(c => c && backColors.add(c))
    }

    console.log('[CardPreview] Colori dalla prima faccia:', frontColors)
    console.log('[CardPreview] Colori dalla seconda faccia:', backColors)

    if (retroCardHasManaCost) {
      extractedColors = extractColorsFromManaCost(manaCosts)
    }
    else {
      const corrispondence = colorIdentity.every(color => frontColors.has(color))
      console.log('[CardPreview] Corrispondenza tra frontColors e colorIdentity:', corrispondence)

      if (corrispondence) {
        extractedColors = frontColors
      }
      else {
        extractedColors = new Set(cardColors)
        console.log('[CardPreview] Colori da entrambe le facce:', extractedColors)
      }
    }
  } else {
    // Carte solo fronte
    console.log('[CardPreview] 📢 Carta a faccia singola rilevata:', props.card.name)
    const manaCost = props.card.mana_cost || ''
    console.log('[CardPreview] Costo di Mana:', manaCost)

    extractedColors = extractColorsFromManaCost(manaCost)

    if (extractedColors.size === 0 && props.card.color_identity) {
      props.card.color_identity.forEach(color => extractedColors.add(color))
    }

    if (!extractedColors.has(props.card.color_identity?.[0] || '')) {
      props.card.color_identity?.forEach(color => extractedColors.add(color))
    }
  }

  const manaColors = Array.from(extractedColors)
  console.log('[CardPreview] Colori Estratti:', manaColors)

  // Due colori → gradiente con due stop di colore
  if (manaColors.length === 2) {
    const from = colorMap[manaColors[0] || 'C']
    const to = colorMap[manaColors[1] || 'C']
    return `bg-gradient-to-br from-${from} to-${to}`
  }

  // Tre colori → gradiente con tre stop di colore
  if (manaColors.length === 3) {
    const from = colorMap[manaColors[0] || 'C']
    const via = colorMap[manaColors[1] || 'C']
    const to = colorMap[manaColors[2] || 'C']
    return `bg-gradient-to-r from-${from} via-${via} to-${to}`
  }

  // Quattro+ colori → grigio (limitazione Tailwind)
  if (manaColors.length > 3) {
    return 'bg-gradient-to-br from-amber-200 via-amber-200 to-transparent'
  }

  // Colore singolo → gradiente dal colore al trasparente
  const color = colorMap[manaColors[0] || 'C']
  return `bg-gradient-to-br from-${color} via-${color} to-transparent`
})

const frontImage = computed(() => {
  if (!props.card) return null
  if (isDoubleFaced.value && props.card.card_faces?.[0]?.image_uris?.large) {
    return props.card.card_faces[0].image_uris.large
  }
  return props.card.image_uris?.large
})

const backImage = computed(() => {
  if (!isDoubleFaced.value || !props.card?.card_faces?.[1]?.image_uris?.large) {
    return null
  }
  return props.card.card_faces[1].image_uris.large
})

// Logging quando la carta cambia
watch(() => props.card, (newCard) => {
  if (newCard) {
    console.log('[CardPreview] 🖼️ Card displayed:', newCard.name)
    console.log('[CardPreview] 🎨 Background class:', colorBgClass.value)
    console.log('[CardPreview] 🔄 Double-faced:', isDoubleFaced.value)
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
      :alt="card.card_faces?.[1]?.name || card.name"
      class="w-64 rounded-lg shadow-xl"
      loading="lazy"
    />
  </div>
</template>
