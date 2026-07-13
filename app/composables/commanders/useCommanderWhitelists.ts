// app\composables\commanders\useCommanderWhitelists.ts

export function useCommanderWhitelists() {
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
  const partnerTypeByName = ref<Map<string, string>>(new Map())
  const partnerWithMap = ref<Map<string, string>>(new Map())

  async function loadAllLists() {
    const supabase = useSupabaseClient()
    isLoading.value = true

    try {
      const { data, error } = await supabase
        .from('mtg_commanders')
        .select('card_name, partner_type, keywords, partner_with_scryfall_id')

      if (error || !data) {
        console.error('[useCommanderWhitelists] Error fetching commanders:', error?.message)
        return
      }

      // Reset
      whitelists.value.commander = []
      whitelists.value.partner = []
      whitelists.value.partnerWith = []
      whitelists.value.background = []
      whitelists.value.doctorsCompanion = []
      whitelists.value.companion = []
      whitelists.value.friendForever = []
      partnerTypeByName.value.clear()
      partnerWithMap.value.clear()

      for (const row of data) {
        const name = row.card_name
        whitelists.value.commander.push(name)
        partnerTypeByName.value.set(name, row.partner_type || 'commander')

        if (row.partner_type === 'partner_with' && row.partner_with_scryfall_id) {
          partnerWithMap.value.set(name, row.partner_with_scryfall_id)
        }

        switch (row.partner_type) {
          case 'partner':
            whitelists.value.partner.push(name)
            break
          case 'partner_with':
            whitelists.value.partnerWith.push(name)
            break
          case 'background':
          case 'background_commander':
            whitelists.value.background.push(name)
            break
          case 'doctors_companion':
            whitelists.value.doctorsCompanion.push(name)
            break
          case 'friends_forever':
            whitelists.value.friendForever.push(name)
            break
        }

        if (row.keywords?.includes('Companion')) {
          whitelists.value.companion.push(name)
        }
      }
    } finally {
      isLoading.value = false
    }
  }

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
      case 'background':
      case 'background_commander':
        return [...whitelists.value.background]
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
    whitelists: readonly(whitelists),
    isLoading: readonly(isLoading),
    loadAllLists,
    getPartnerType,
    getAllowedPartners,
  }
}
