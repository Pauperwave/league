const ONE_WEEK = 7 * 24 * 60 * 60 * 1000

/**
 * Recupera dati dalla cache localStorage se non scaduti
 */
function getCached(key: string, ttlMs: number): string[] | null {
  if (typeof window === 'undefined') return null
  console.log(`[useCardWhitelists] 📦 Checking cache for key: ${key}`)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      console.log(`[useCardWhitelists] ❌ Cache miss: ${key} not found`)
      return null
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.ts !== 'number') {
      console.log(`[useCardWhitelists] ❌ Cache invalid: ${key}`)
      return null
    }

    const age = Date.now() - parsed.ts
    const ageHours = Math.round(age / (1000 * 60 * 60) * 10) / 10
    console.log(`[useCardWhitelists] ⏱️ Cache age for ${key}: ${ageHours}h`)

    if (age > ttlMs) {
      console.log(`[useCardWhitelists] ⌛ Cache expired for ${key}, removing...`)
      localStorage.removeItem(key)
      return null
    }
    console.log(`[useCardWhitelists] ✅ Cache hit: ${key} (${parsed.data?.length || 0} items)`)
    return parsed.data
  }
  catch (err) {
    console.log(`[useCardWhitelists] 💥 Cache error for ${key}:`, err)
    return null
  }
}

/**
 * Salva dati in localStorage con timestamp
 */
function setCached(key: string, data: string[]) {
  if (typeof window === 'undefined') return
  console.log(`[useCardWhitelists] 💾 Saving to cache: ${key} (${data.length} items)`)
  localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }))
  console.log(`[useCardWhitelists] ✅ Cache saved: ${key}`)
}

/**
 * Recupera tutti i nomi delle carte da un endpoint Scryfall paginato
 */
async function fetchAllNames(initialUrl: string): Promise<string[]> {
  console.log(`[useCardWhitelists] 🌐 Fetching from Scryfall: ${initialUrl.substring(0, 60)}...`)
  try {
    let url: string | null = initialUrl
    const allNames: string[] = []
    let pageCount = 0

    while (url) {
      pageCount++
      console.log(`[useCardWhitelists] 📄 Fetching page ${pageCount}...`)
      const page = await fetch(url).then(r => r.json())
      const names = (page.data || []).map((card: { name: string }) => card.name)
      console.log(`[useCardWhitelists] 📄 Page ${pageCount}: ${names.length} cards`)
      allNames.push(...names)
      url = page.next_page || null
      if (url) {
        console.log(`[useCardWhitelists] ➡️ More pages available, continuing...`)
      }
    }

    console.log(`[useCardWhitelists] ✅ Total fetched: ${allNames.length} cards from ${pageCount} page(s)`)
    return allNames
  }
  catch (error) {
    console.error(`[useCardWhitelists] 💥 Error fetching pages:`, error)
    return []
  }
}

export function useCardWhitelists() {
  const whitelists = ref({
    commander: [] as string[],
    partner: [] as string[],
    partnerWith: [] as string[],
    background: [] as string[],
    doctorsCompanion: [] as string[],
    companion: [] as string[],
    friendForever: [] as string[],
  })

  const isLoading = ref(true)

  async function loadWhitelist(
    cacheKey: string,
    query: string,
    whitelistKey: keyof typeof whitelists.value,
    description: string,
  ) {
    console.log(`[useCardWhitelists] 🔄 Loading whitelist: ${description} (${cacheKey})`)

    const cached = getCached(cacheKey, ONE_WEEK)
    if (cached) {
      console.log(`[useCardWhitelists] ✅ Loaded "${description}" from cache: ${cached.length} items`)
      whitelists.value[whitelistKey] = cached
      return
    }

    console.log(`[useCardWhitelists] 🌐 Cache miss for "${description}", fetching from Scryfall...`)
    try {
      const encodedQuery = encodeURIComponent(query)
      const initialUrl = `https://api.scryfall.com/cards/search?q=${encodedQuery}`
      const cardNames = await fetchAllNames(initialUrl)

      console.log(`[useCardWhitelists] ✅ Fetched "${description}" from Scryfall: ${cardNames.length} items`)

      whitelists.value[whitelistKey] = cardNames
      setCached(cacheKey, cardNames)
      console.log(`[useCardWhitelists] 💾 "${description}" whitelist saved and ready`)
    }
    catch (error) {
      console.error(`[useCardWhitelists] 💥 Error loading "${description}":`, error)
      whitelists.value[whitelistKey] = []
    }
  }

  async function loadAllLists() {
    console.log('[useCardWhitelists] 🚀 Starting to load all whitelists...')
    isLoading.value = true

    await Promise.all([
      // Carte che possono essere "Commander"
      loadWhitelist(
        'cw_list_can-be-commander_v1',
        '(game:paper) is:commander',
        'commander',
        'Commanders',
      ),
      // Commander con abilità "Partner"
      loadWhitelist(
        'cw_list_commander-partner_v1',
        'is:commander o:"partner" -o:"partner with" -o:background',
        'partner',
        'Partners',
      ),
      // Background
      loadWhitelist(
        'cw_list_is-background_v1',
        'type:background',
        'background',
        'Backgrounds',
      ),
      // Companion del Doctor
      loadWhitelist(
        'cw_list_doctor-companion_v1',
        'o:Doctor\'s o:companion',
        'doctorsCompanion',
        'Doctor\'s companions',
      ),
      // Companion
      loadWhitelist(
        'cw_list_companion_v1',
        'is:companion legal:commander',
        'companion',
        'Companions',
      ),
      // Friends Forever
      loadWhitelist(
        'cw_list_friends-forever_v1',
        'o:friends o:forever',
        'friendForever',
        'Friends Forever',
      ),
    ])

    isLoading.value = false
    console.log('[useCardWhitelists] 🎉 All whitelists loaded!')
    console.log('[useCardWhitelists] 📊 Summary:')
    console.log(`  - Commanders: ${whitelists.value.commander.length}`)
    console.log(`  - Partners: ${whitelists.value.partner.length}`)
    console.log(`  - Backgrounds: ${whitelists.value.background.length}`)
    console.log(`  - Doctor's Companions: ${whitelists.value.doctorsCompanion.length}`)
    console.log(`  - Companions: ${whitelists.value.companion.length}`)
    console.log(`  - Friends Forever: ${whitelists.value.friendForever.length}`)
  }

  return {
    whitelists: readonly(whitelists),
    isLoading: readonly(isLoading),
    loadAllLists,
  }
}
