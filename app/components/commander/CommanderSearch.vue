<!-- app\components\commander\CommanderSearch.vue -->
<script setup lang="ts">

const props = defineProps<{
  whitelist?: string[] | null
  playerId?: number | null
}>()

const modelValue = defineModel<string | null>()

const { t } = useI18n()

// Logging when the whitelist changes
watch(() => props.whitelist, (newWhitelist) => {
  console.log('[CommanderSearch] 🎫 Whitelist changed:', newWhitelist?.length || 0, 'items')
}, { immediate: true })

const {
  query,
  suggestions,
  showSuggestions,
  selectedIndex,
  isLoading,
  handleSelect,
  card,
  suggestionMeta,
  navigateSuggestions,
  selectCurrent,
  closeSuggestions,
} = useCommanderSearch({
  whitelist: props.whitelist,
  playerId: props.playerId,
})

/**
 * Converts a mana symbol to a mana-font class
 * {W} → ms ms-w, {2} → ms ms-2, etc.
 */
function getManaFontClass(token: string): string {
  // Strip the curly braces
  const symbol = token.replace(/[{}]/g, '').toLowerCase()

  // Map special symbols
  const specialMap: Record<string, string> = {
    'w': 'ms ms-w',
    'u': 'ms ms-u',
    'b': 'ms ms-b',
    'r': 'ms ms-r',
    'g': 'ms ms-g',
    'c': 'ms ms-c', // colorless
    'p': 'ms ms-p', // phyrexian
    'wp': 'ms ms-wp',
    'up': 'ms ms-up',
    'bp': 'ms ms-bp',
    'rp': 'ms ms-rp',
    'gp': 'ms ms-gp',
    'x': 'ms ms-x',
    'y': 'ms ms-y',
    'z': 'ms ms-z',
    't': 'ms ms-tap',
    'q': 'ms ms-untap',
    'e': 'ms ms-e', // energy
    's': 'ms ms-s', // snow
  }

  // If it's a number (0-20+), use ms-{number}
  if (/^\d+$/.test(symbol)) {
    return `ms ms-${symbol}`
  }

  return specialMap[symbol] || `ms ms-${symbol}`
}

// Logging when the card changes
watch(card, (newCard) => {
  if (newCard) {
    console.log('[CommanderSearch] 🖼️ Card loaded:', newCard.name)
  }
})

const localValue = computed({
  get: () => modelValue.value || '',
  set: (v: string) => { modelValue.value = v || null }
})

watch(modelValue, (newValue) => {
  console.log('[CommanderSearch] modelValue changed:', newValue)
  query.value = newValue || ''
  console.log('[CommanderSearch] query set from modelValue:', query.value)
})

watch(suggestions, (newSuggestions) => {
  console.log('[CommanderSearch] suggestions updated:', newSuggestions.length, 'items')
  if (props.whitelist && props.whitelist.length > 0) {
    console.log('[CommanderSearch] 🎫 Using whitelist filtering,', newSuggestions.length, 'of', props.whitelist.length, 'cards shown')
  }
})

watch(showSuggestions, (newValue) => {
  console.log('[CommanderSearch] showSuggestions changed:', newValue)
})

/**
 * Highlights the part of the query that matches in the suggestion
 */
function highlightMatch(text: string, query: string) {
  if (!query) return text

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig')
  const parts = text.split(regex)

  return parts.map((part) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return h('span', { class: 'bg-rose-100 text-black rounded px-0.5' }, part)
    }
    return part
  })
}

function handleSuggestionClick(suggestion: string) {
  localValue.value = suggestion
  handleSelect(suggestion)
  showSuggestions.value = false
}

function handleBlur() {
  // Delay hiding suggestions to allow click to register
  setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}

function handleKeydown(e: KeyboardEvent) {
  if (!showSuggestions.value) {
    if (e.key === 'ArrowDown' && suggestions.value.length > 0) {
      showSuggestions.value = true
    }
    return
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      navigateSuggestions('down')
      break
    case 'ArrowUp':
      e.preventDefault()
      navigateSuggestions('up')
      break
    case 'Enter':
      e.preventDefault()
      selectCurrent()
      break
    case 'Escape':
      e.preventDefault()
      closeSuggestions()
      break
  }
}
</script>

<template>
  <div class="relative">
    <UInput
      v-model="localValue"
      :placeholder="t('commander.searchPlaceholder')"
      :loading="isLoading"
      @focus="showSuggestions = true"
      @blur="handleBlur"
      @keydown="handleKeydown"
    />
    <div
      v-if="showSuggestions && suggestions.length > 0"
      class="absolute z-50 w-full mt-1 bg-default border rounded-md shadow-lg max-h-60 overflow-auto"
      role="listbox"
    >
      <div
        v-for="(suggestion, index) in suggestions"
        :key="suggestion"
        :class="[
          'flex items-center gap-2 px-4 py-2 cursor-pointer',
          index === selectedIndex ? 'bg-muted' : 'hover:bg-muted/50'
        ]"
        role="option"
        :aria-selected="index === selectedIndex"
        @mousedown="handleSuggestionClick(suggestion)"
      >
        <!-- Mana cost symbols with mana-font -->
        <span
          v-if="suggestionMeta[suggestion]?.tokens?.length"
          class="flex items-center gap-0.5 shrink-0 bg-gray-950 p-1 rounded"
        >
          <i
            v-for="(token, idx) in suggestionMeta[suggestion].tokens"
            :key="`${suggestion}-${token}-${idx}`"
            :class="getManaFontClass(token)"
            class="text-lg"
          />
        </span>

        <!-- Highlighted card name -->
        <span class="truncate">
          <component :is="() => highlightMatch(suggestion, query)" />
        </span>
      </div>
    </div>

    <!-- Preview of the selected card -->
    <CardPreview :card="card" />
  </div>
</template>
