// app\composables\commanders\useCommanderWhitelists.ts

export function useCommanderWhitelists() {
  const { data: catalog, isLoading, refetch } = useCommanderCatalogQuery()

  const whitelists = computed(() => {
    const result = {
      commander: [] as string[],
      partner: [] as string[],
      partnerWith: [] as string[],
      // True Background enchantment cards (e.g. "Candlekeep Sage") — valid
      // commander2 options for a background_commander commander1.
      background: [] as string[],
      // Legendary creatures with "Choose a Background" (e.g. "Jaheira, Friend
      // of the Forest") — these need an actual Background as their second
      // commander, NOT another background-choosing creature. Kept in a
      // separate array from `background` so the two can never be offered as
      // partners for each other (they were previously merged into one list,
      // which incorrectly allowed pairing two background-choosing creatures).
      backgroundCommander: [] as string[],
      doctorsCompanion: [] as string[],
      companion: [] as string[],
      friendForever: [] as string[],
    }

    for (const row of catalog.value ?? []) {
      result.commander.push(row.name)

      switch (row.partnerType) {
        case 'partner':
          result.partner.push(row.name)
          break
        case 'partner_with':
          result.partnerWith.push(row.name)
          break
        case 'background':
          result.background.push(row.name)
          break
        case 'background_commander':
          result.backgroundCommander.push(row.name)
          break
        case 'doctors_companion':
          result.doctorsCompanion.push(row.name)
          break
        case 'friends_forever':
          result.friendForever.push(row.name)
          break
      }

      if (row.keywords.includes('Companion')) {
        result.companion.push(row.name)
      }
    }

    return result
  })

  const partnerTypeByName = computed(() => {
    const map = new Map<string, string>()
    for (const row of catalog.value ?? []) {
      map.set(row.name, row.partnerType || 'commander')
    }
    return map
  })

  const partnerWithMap = computed(() => {
    const map = new Map<string, string>()
    for (const row of catalog.value ?? []) {
      if (row.partnerType === 'partner_with' && row.partnerWithScryfallId) {
        map.set(row.name, row.partnerWithScryfallId)
      }
    }
    return map
  })

  /**
   * Get the partner_type for a given commander name.
   * Returns 'commander' for normal commanders, or the specific type.
   */
  function getPartnerType(cardName: string): string {
    return partnerTypeByName.value.get(cardName) || 'commander'
  }

  /**
   * Given a commander1 name, return the list of allowed commander2 names.
   * Returns empty array if commander1 cannot have a partner.
   */
  function getAllowedPartners(commander1Name: string): string[] {
    const type = getPartnerType(commander1Name)

    switch (type) {
      case 'partner':
        return [...whitelists.value.partner]
      case 'partner_with':
        // For "partner with", return all partnerWith cards
        // In the future, this could be narrowed to the exact matching partner
        return [...whitelists.value.partnerWith]
      case 'background_commander':
        // A "Choose a Background" creature needs an actual Background card.
        return [...whitelists.value.background]
      case 'background':
        // An actual Background card (rarely picked as commander1 in the UI,
        // but supported) needs a background-choosing creature.
        return [...whitelists.value.backgroundCommander]
      case 'friends_forever':
        return [...whitelists.value.friendForever]
      case 'doctors_companion':
        return [...whitelists.value.doctorsCompanion]
      case 'companion':
        return [...whitelists.value.companion]
      case 'commander':
      default:
        return []
    }
  }

  return {
    whitelists,
    isLoading,
    refetch,
    getPartnerType,
    getAllowedPartners,
  }
}
