// app\composables\league\useLeaguesPage.ts
// Orchestrates the leagues list page: Colada query state + modal UI state +
// create/delete handlers with toasts. Successor of the store-based
// useLeagues (ADR-015).
import type { League } from '#shared/utils/types'
import type { LeagueFormPayload } from '~/composables/league/useLeagueMutations'

export function useLeaguesPage() {
  const router = useRouter()
  const toast = useToast()
  const { t } = useI18n()

  const { data, error, isLoading: loading } = useLeaguesQuery()
  const leagues = computed(() => data.value ?? [])

  const { data: rulesetsData, isLoading: rulesetsLoading } = useRulesetsQuery()
  const rulesets = computed(() => rulesetsData.value ?? [])

  const errorMessage = computed(() =>
    error.value ? toErrorMessage(error.value, t('store.league.loadError')) : t('common.loadError')
  )

  const { createLeague, deleteLeague } = useLeagueMutations()

  // UI state — page-level only, not shared
  const showCreateModal = ref(false)
  const leagueToDelete = ref<League | null>(null)
  const showDeleteConfirm = ref(false)

  async function handleCreateLeague(payload: LeagueFormPayload) {
    try {
      await createLeague.mutateAsync(payload)
    } catch (err) {
      toast.add({
        title: t('league.toast.createErrorTitle'),
        description: toErrorMessage(err, t('store.league.createError')),
        color: 'error'
      })
      return
    }
    showCreateModal.value = false
    toast.add({
      title: t('league.toast.createdTitle'),
      description: t('league.toast.createdDescription', { name: payload.name }),
      color: 'success'
    })
  }

  function handleDeleteLeague(league: League) {
    leagueToDelete.value = league
    showDeleteConfirm.value = true
  }

  async function confirmDeleteLeague() {
    if (!leagueToDelete.value) return
    try {
      await deleteLeague.mutateAsync(leagueToDelete.value.id)
    } catch (err) {
      toast.add({
        title: t('league.toast.deleteErrorTitle'),
        description: isConflictError(err)
          ? t('store.league.inUseError')
          : toErrorMessage(err, t('store.league.deleteError')),
        color: 'error'
      })
      return
    }
    showDeleteConfirm.value = false
    leagueToDelete.value = null
    toast.add({ title: t('league.toast.deletedTitle'), color: 'success' })
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
