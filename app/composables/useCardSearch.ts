import { ref, watch, onUnmounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { NUMBER_OF_SUGGESTED_CARDS, MIN_QUERY_LENGTH, DEBOUNCE_DELAY, ONE_WEEK } from '~/config/searchConfig'
import { getCached, setCached } from '~/utils/localStorage'

interface ScryfallCard {
  id?: string
  name: string
  oracle_text?: string
  keywords?: string[]
  type_line?: string
  color_identity?: string[]
  card_faces?: Array<{
    name?: string
    mana_cost?: string
    colors?: string[]
    image_uris?: {
      large?: string
    }
  }>
  image_uris?: {
    large?: string
  }
  mana_cost?: string
  all_parts?: Array<{
    component?: string
    object?: string
    name?: string
  }>
}

interface SuggestionMeta {
  mana_cost: string
  tokens: string[]
}

export function useCardSearch(options: { detectFlags?: boolean, whitelist?: string[] | null } = {}) {
  const { detectFlags = false, whitelist = null } = options

  // State
  const query = ref('')
  const suggestions = ref<string[]>([])
  const showSuggestions = ref(false)
  const selectedIndex = ref(-1) // -1 = no selection
  const isLoading = ref(false)
  const card = ref<ScryfallCard | null>(null)
  const hasPartner = ref(false)
  const hasPartnerWith = ref(false)
  const partnerWithCard = ref<string | null>(null)
  const hasBackground = ref(false)
  const isDoctor = ref(false)
  const isCompanion = ref(false)
  const isFriendsForever = ref(false)

  // Cache
  const symbolMap = ref<Record<string, string>>({})
  const symbolsLoading = ref(true)
  const cardCache = ref(new Map<string, ScryfallCard>())
  const suggestionMeta = ref<Record<string, SuggestionMeta>>({})

  // API URLs
  const API_URL_AUTOCOMPLETE = 'https://api.scryfall.com/cards/autocomplete'
  const API_URL_NAMED = 'https://api.scryfall.com/cards/named?exact='
  const API_URL_SYMBOLOGY = 'https://api.scryfall.com/symbology'

  const SYMBOLOGY_TTL_MS = ONE_WEEK
  const NAMED_TTL_MS = ONE_WEEK
  const MINCARD_TTL_MS = ONE_WEEK

  // Helpers
  const tokenizeManaCost = (manaCost: string | undefined): string[] => {
    if (!manaCost || typeof manaCost !== 'string') return []
    const matches = manaCost.match(/\{[^}]+\}/g)
    return matches || []
  }

  // Load symbol map once (cached)
  const loadSymbolMap = async () => {
    const cached = getCached<Record<string, string>>('cw_list_symbology_v1', SYMBOLOGY_TTL_MS)
    if (cached) {
      symbolMap.value = cached
      symbolsLoading.value = false
      return
    }

    try {
      const response = await fetch(API_URL_SYMBOLOGY)
      const json = await response.json()
      const map: Record<string, string> = {}

      ;(json.data || []).forEach((sym: { symbol?: string, svg_uri?: string }) => {
        if (sym?.symbol && sym?.svg_uri) {
          map[sym.symbol] = sym.svg_uri
        }
      })

      symbolMap.value = map
      symbolsLoading.value = false
      setCached('cw_list_symbology_v1', map)
    }
    catch (error) {
      console.error('Error loading symbol map:', error)
      symbolsLoading.value = false
    }
  }

  loadSymbolMap()

  // Detect and set flags from card
  const detectAndSetFlagsFromCard = (cardObj: ScryfallCard | null) => {
    if (!detectFlags || !cardObj) return

    const text = cardObj.oracle_text?.toLowerCase() || ''
    const keywords = cardObj.keywords ?? []

    const includesPartner = keywords.includes('Partner') && !keywords.some(k => k.startsWith('Partner with'))
    const includesPartnerWith = keywords.some(k => k.startsWith('Partner with')) || false
    const includesBackground = text.includes('background')
    const isDoctorCard = cardObj.type_line?.includes('Time Lord Doctor') || false
    const isCompanionCard = keywords.includes('companion')
    const isFriendsForeverCard = keywords.includes('Friends forever')

    // Find partner with card
    const partnerPart = includesPartnerWith
      ? cardObj.all_parts?.find(
          part =>
            part.component === 'combo_piece'
            && part.object === 'related_card'
            && part.name !== cardObj.name,
        )
      : undefined

    hasPartner.value = includesPartner
    hasPartnerWith.value = includesPartnerWith
    hasBackground.value = includesBackground
    isDoctor.value = isDoctorCard
    isCompanion.value = isCompanionCard
    isFriendsForever.value = isFriendsForeverCard

    if (includesPartnerWith || partnerPart) {
      partnerWithCard.value = partnerPart?.name || null
    }

    console.log('useCardSearch: Card analysis', {
      card: cardObj.name,
      colorIdentity: cardObj.color_identity,
      background: includesBackground,
      partner: includesPartner,
      partnerWith: includesPartnerWith,
      partnerCard: partnerPart?.name,
      doctor: isDoctorCard,
      companion: isCompanionCard,
      friendsForever: isFriendsForeverCard,
    })
  }

  // Fetch card details
  const fetchCardDetails = async (name: string) => {
    const cached = getCached<ScryfallCard>(`cw_card_full_${name}`, NAMED_TTL_MS)
    if (cached) {
      card.value = cached
      detectAndSetFlagsFromCard(cached)
      return
    }

    try {
      const response = await fetch(`${API_URL_NAMED}${encodeURIComponent(name)}`)
      const data = await response.json()
      card.value = data
      setCached(`cw_card_full_${name}`, data)
      detectAndSetFlagsFromCard(data)
    }
    catch (error) {
      console.error('Error fetching card details:', error)
    }
  }

  // Fetch suggestions
  const fetchSuggestions = async (q: string) => {
    console.log('[useCardSearch] fetchSuggestions called with query:', q)
    if (!q || q.length < MIN_QUERY_LENGTH) {
      console.log('[useCardSearch] Query too short or empty, clearing suggestions')
      suggestions.value = []
      showSuggestions.value = false
      selectedIndex.value = -1
      return
    }

    isLoading.value = true

    const queueSuggestionsMetaLoad = async (names: string[]) => {
      const top = (names || []).slice(0, NUMBER_OF_SUGGESTED_CARDS)
      if (top.length === 0) return

      const results = await Promise.all(top.map(async (name) => {
        if (!name) return null

        // Check in-memory cache first
        if (cardCache.value.has(name)) {
          return { name, data: cardCache.value.get(name) }
        }

        // Check localStorage minimal cache
        const minCached = getCached<{ name: string, mana_cost?: string, card_faces?: Array<{ mana_cost?: string }> }>(`cw_card_minimal_${name}`, MINCARD_TTL_MS)
        if (minCached) {
          return { name, data: minCached }
        }

        // Fetch from API
        try {
          const res = await fetch(`${API_URL_NAMED}${encodeURIComponent(name)}`)
          const data = await res.json()

          cardCache.value.set(name, data)

          const minimal = {
            name: data.name,
            ...(data.mana_cost && { mana_cost: data.mana_cost }),
            ...(data.card_faces && {
              card_faces: data.card_faces.map((face: { mana_cost?: string }) => ({
                mana_cost: face.mana_cost || '',
              })),
            }),
          }
          setCached(`cw_card_minimal_${name}`, minimal)

          return { name, data }
        }
        catch {
          return null
        }
      }))

      const updates: Record<string, SuggestionMeta> = {}

      results.forEach((item) => {
        if (!item) return

        const { name } = item
        let manaCost = ''

        if (item.data) {
          const data = item.data
          manaCost = data.mana_cost || ''
          if (!manaCost && Array.isArray(data.card_faces) && data.card_faces.length > 0) {
            manaCost = data.card_faces[0]?.mana_cost || ''
          }
        }

        updates[name] = {
          mana_cost: manaCost,
          tokens: tokenizeManaCost(manaCost),
        }
      })

      if (Object.keys(updates).length > 0) {
        suggestionMeta.value = { ...suggestionMeta.value, ...updates }
      }
    }

    // If whitelist is provided, filter locally
    if (Array.isArray(whitelist) && whitelist.length > 0) {
      const filtered = whitelist
        .filter((name: string) => name && name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, NUMBER_OF_SUGGESTED_CARDS)
      suggestions.value = filtered
      queueSuggestionsMetaLoad(filtered)
      return
    }

    try {
      console.log('[useCardSearch] Calling Scryfall autocomplete API with query:', q)
      const response = await fetch(`${API_URL_AUTOCOMPLETE}?q=${encodeURIComponent(q)}`)
      console.log('[useCardSearch] API response status:', response.status)
      const data = await response.json()
      console.log('[useCardSearch] API response data:', data)
      const filtered = (data.data || []).filter((name: string) => !name.startsWith('A-'))
      console.log('[useCardSearch] Filtered suggestions:', filtered)
      suggestions.value = filtered
      console.log('[useCardSearch] suggestions.value set to:', suggestions.value)
      if (filtered.length > 0) {
        showSuggestions.value = true
        console.log('[useCardSearch] showSuggestions set to true because we have suggestions')
      }
      queueSuggestionsMetaLoad(filtered.slice(0, NUMBER_OF_SUGGESTED_CARDS))
    }
    catch (error) {
      console.error('[useCardSearch] Error fetching suggestions:', error)
    }
    finally {
      isLoading.value = false
    }
  }

  // Debounced fetch
  const debouncedFetch = useDebounceFn(fetchSuggestions, DEBOUNCE_DELAY)

  // Watch query changes
  watch(query, (newQuery) => {
    console.log('[useCardSearch] query changed, calling debouncedFetch with:', newQuery)
    debouncedFetch(newQuery)
  })

  // Handle selection
  const handleSelect = (name: string | null) => {
    query.value = name || ''
    showSuggestions.value = false
    selectedIndex.value = -1

    if (name) {
      fetchCardDetails(name)
    }
    else {
      card.value = null
      if (detectFlags) {
        hasPartner.value = false
        hasPartnerWith.value = false
        hasBackground.value = false
        isDoctor.value = false
        isCompanion.value = false
        isFriendsForever.value = false
        partnerWithCard.value = null
      }
    }
  }

  // Keyboard navigation helpers
  const navigateSuggestions = (direction: 'up' | 'down') => {
    if (!showSuggestions.value || suggestions.value.length === 0) return

    if (direction === 'down') {
      selectedIndex.value = Math.min(selectedIndex.value + 1, suggestions.value.length - 1)
    }
    else {
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
    }
  }

  const selectCurrent = () => {
    if (selectedIndex.value >= 0 && selectedIndex.value < suggestions.value.length) {
      handleSelect(suggestions.value[selectedIndex.value] || null)
    }
    else if (suggestions.value.length > 0) {
      // Se nessuno selezionato, prendi il primo
      handleSelect(suggestions.value[0] || null)
    }
  }

  const closeSuggestions = () => {
    showSuggestions.value = false
    selectedIndex.value = -1
  }

  const openSuggestions = () => {
    if (suggestions.value.length > 0) {
      showSuggestions.value = true
    }
  }

  // Cleanup
  onUnmounted(() => {
    // Cleanup if needed
  })

  return {
    query,
    setQuery: (value: string) => { query.value = value },
    suggestions,
    showSuggestions,
    setShowSuggestions: (value: boolean) => { showSuggestions.value = value },
    selectedIndex,
    isLoading,
    card,
    handleSelect,
    hasPartner,
    hasPartnerWith,
    partnerWithCard,
    hasBackground,
    isDoctor,
    isCompanion,
    isFriendsForever,
    suggestionMeta,
    symbolMap,
    symbolsLoading,
    navigateSuggestions,
    selectCurrent,
    closeSuggestions,
    openSuggestions,
  }
}
