import type { League } from '~/types/database'

/**
 * Composable per gestire i dati delle leghe.
 * Usa lo store come single source of truth.
 * Il fetching è gestito via useAsyncData per SSR.
 */
export function useLeagues() {
  const store = useLeagueStore()
  const router = useRouter()

  const { data: rulesetsData, pending: rulesetsLoading } = useRulesets()

  const { pending: loading, error } = useAsyncData('leagues-list', async () => {
    await store.fetchLeagues()
  }, {
    server: true
  })

  const leagues = computed(() => store.leagues)
  const rulesets = computed(() => rulesetsData.value ?? [])
  const errorMessage = computed(() => error.value?.message ?? store.error ?? 'Errore nel caricamento')

  // UI state — page-level only, not shared
  const showCreateModal = ref(false)
  const leagueToDelete = ref<League | null>(null)
  const showDeleteConfirm = ref(false)

  async function handleCreateLeague(data: {
    name: string
    startsAt: string
    rulesetId: number
  }) {
    const result = await store.createLeague({
      name: data.name,
      starts_at: data.startsAt,
      status: 'Programmata',
      ruleset_id: data.rulesetId
    })

    if (result.success) {
      showCreateModal.value = false
    }

    return result
  }

  function handleDeleteLeague(league: League) {
    leagueToDelete.value = league
    showDeleteConfirm.value = true
  }

  async function confirmDeleteLeague() {
    if (!leagueToDelete.value) return { success: false }

    const result = await store.deleteLeague(leagueToDelete.value.id)

    if (result.success) {
      leagueToDelete.value = null
      showDeleteConfirm.value = false
    }

    return result
  }

  function navigateToLeague(league: League) {
    // Let the target page resolve the league from the route param
    router.push(`/league/${league.id}`)
  }

  return {
    leagues,
    rulesets,
    rulesetsLoading,
    loading,
    error,
    errorMessage,
    showCreateModal,
    leagueToDelete,
    showDeleteConfirm,
    handleCreateLeague,
    handleDeleteLeague,
    confirmDeleteLeague,
    navigateToLeague
  }
}
