// app\composables\deck\useDeckDisplay.ts

interface DeckDisplayInfo {
  commander_1_name: string
  commander_2_name: string | null
}

/** Shared display name + Scryfall search URL for a deck's commander(s). */
export function useDeckDisplay(deck: Ref<DeckDisplayInfo | null>) {
  const { t } = useI18n()

  const commanderDisplayName = computed(() => {
    if (deck.value?.commander_2_name) {
      return `${deck.value.commander_1_name} // ${deck.value.commander_2_name}`
    }
    return deck.value?.commander_1_name ?? t('deck.fallbackName')
  })

  const scryfallSearchUrl = computed(() => {
    if (!deck.value) return '#'
    return `https://scryfall.com/search?q=!"${encodeURIComponent(deck.value.commander_1_name)}"`
  })

  return { commanderDisplayName, scryfallSearchUrl }
}
