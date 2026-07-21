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
  logDebug('CommanderSearch', '🎫 Whitelist changed:', newWhitelist?.length || 0, 'items')
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
  whitelist: () => props.whitelist,
  playerId: () => props.playerId,
})

// Logging when the card changes
watch(card, (newCard) => {
  if (newCard) {
    logDebug('CommanderSearch', '🖼️ Card loaded:', newCard.name)
  }
})

const localValue = computed({
  get: () => modelValue.value || '',
  set: (v: string) => { modelValue.value = v || null }
})

watch(modelValue, (newValue) => {
  logDebug('CommanderSearch', 'modelValue changed:', newValue)
  query.value = newValue || ''
  logDebug('CommanderSearch', 'query set from modelValue:', query.value)
})

watch(suggestions, (newSuggestions) => {
  logDebug('CommanderSearch', 'suggestions updated:', newSuggestions.length, 'items')
  if (props.whitelist && props.whitelist.length > 0) {
    logDebug('CommanderSearch', '🎫 Using whitelist filtering,', newSuggestions.length, 'of', props.whitelist.length, 'cards shown')
  }
})

watch(showSuggestions, (newValue) => {
  logDebug('CommanderSearch', 'showSuggestions changed:', newValue)
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
        <!-- Mana cost symbols -->
        <span
          v-if="suggestionMeta[suggestion]?.tokens?.length"
          class="shrink-0 bg-gray-950 p-1 rounded"
        >
          <ManaCost :mana-cost="suggestionMeta[suggestion].tokens.join('')" size="lg" />
        </span>

        <!-- Highlighted card name -->
        <span class="truncate min-w-0">
          <component :is="() => highlightMatch(suggestion, query)" />
        </span>
      </div>
    </div>

    <!-- Preview of the selected card -->
    <CardPreview :card="card" />
  </div>
</template>
