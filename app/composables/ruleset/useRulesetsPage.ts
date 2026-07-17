// app\composables\ruleset\useRulesetsPage.ts
// fallow-ignore-file code-duplication -- intentional CRUD handler boilerplate (create/update share the try/mutate/toast shape), successor of the store-era pragma
// Orchestrates the rulesets page: Colada query state + modal UI state +
// CRUD handlers with toasts. Successor of the store-based useRulesets
// (ADR-015). The "which leagues use this ruleset" info derives from the
// cached ['leagues'] query — no bespoke combined fetch anymore.
import type { Ruleset } from '#shared/utils/types'
import type { RulesetFormPayload } from '~/composables/ruleset/useRulesetMutations'

/** True when a $fetch error is the endpoint's 409 "ruleset in use" answer. */
function isInUseConflict(err: unknown): boolean {
  return typeof err === 'object' && err !== null
    && 'statusCode' in err && (err as { statusCode?: number }).statusCode === 409
}

export function useRulesetsPage() {
  const toast = useToast()
  const { t } = useI18n()
  const editRulesetLogging = useButtonLogging('Edit Ruleset')

  const { data, error, isLoading: loading } = useRulesetsQuery()
  const rulesets = computed(() => data.value ?? [])

  const { data: leaguesData } = useLeaguesQuery()

  const errorMessage = computed(() =>
    error.value ? toErrorMessage(error.value, t('store.ruleset.loadError')) : t('common.loadError')
  )

  const { createRuleset, updateRuleset, deleteRuleset } = useRulesetMutations()

  // UI state — page-level only, not shared
  const showFormModal = ref(false)
  const showDeleteConfirm = ref(false)
  const rulesetToEdit = ref<Ruleset | null>(null)
  const rulesetToDelete = ref<Ruleset | null>(null)

  const leaguesMap = computed(() => {
    const map = new Map<number, { id: number, name: string }[]>()
    for (const league of leaguesData.value ?? []) {
      if (league.ruleset_id !== null) {
        if (!map.has(league.ruleset_id)) map.set(league.ruleset_id, [])
        map.get(league.ruleset_id)!.push({ id: league.id, name: league.name })
      }
    }
    return map
  })

  function isRulesetInUse(rulesetId: number): boolean {
    return leaguesMap.value.has(rulesetId)
  }

  function getLeaguesByRuleset(rulesetId: number): { id: number, name: string }[] {
    return leaguesMap.value.get(rulesetId) ?? []
  }

  async function handleCreateRuleset(payload: RulesetFormPayload) {
    try {
      await createRuleset.mutateAsync(payload)
    } catch (err) {
      toast.add({
        title: t('ruleset.toast.createErrorTitle'),
        description: toErrorMessage(err, t('store.ruleset.createError')),
        color: 'error'
      })
      return
    }
    showFormModal.value = false
    rulesetToEdit.value = null
    toast.add({
      title: t('ruleset.toast.createdTitle'),
      description: t('ruleset.toast.createdDescription', { name: payload.name }),
      color: 'success'
    })
  }

  function handleEditClick(ruleset: Ruleset | null) {
    editRulesetLogging.logClick()
    rulesetToEdit.value = ruleset
    showFormModal.value = true
  }

  async function handleUpdateRuleset({ id, data: payload }: { id: number, data: RulesetFormPayload }) {
    try {
      await updateRuleset.mutateAsync({ id, data: payload })
    } catch (err) {
      toast.add({
        title: t('ruleset.toast.updateErrorTitle'),
        description: toErrorMessage(err, t('store.ruleset.updateError')),
        color: 'error'
      })
      return
    }
    showFormModal.value = false
    rulesetToEdit.value = null
    toast.add({ title: t('ruleset.toast.updatedTitle'), color: 'success' })
  }

  function handleDeleteClick(ruleset: Ruleset) {
    rulesetToDelete.value = ruleset
    showDeleteConfirm.value = true
  }

  async function confirmDeleteRuleset() {
    if (!rulesetToDelete.value) return
    try {
      await deleteRuleset.mutateAsync(rulesetToDelete.value.ruleset_id)
    } catch (err) {
      toast.add({
        title: t('ruleset.toast.deleteErrorTitle'),
        description: isInUseConflict(err)
          ? t('store.ruleset.inUseError')
          : toErrorMessage(err, t('store.ruleset.deleteError')),
        color: 'error'
      })
      return
    }
    showDeleteConfirm.value = false
    rulesetToDelete.value = null
    toast.add({ title: t('ruleset.toast.deletedTitle'), color: 'success' })
  }

  return {
    rulesets,
    loading,
    error,
    errorMessage,
    showFormModal,
    showDeleteConfirm,
    rulesetToEdit,
    rulesetToDelete,
    isRulesetInUse,
    getLeaguesByRuleset,
    handleCreateRuleset,
    handleEditClick,
    handleUpdateRuleset,
    handleDeleteClick,
    confirmDeleteRuleset
  }
}
