// app\composables\league\useLeagueUpdate.ts
import type { LeagueFormPayload } from '~/composables/league/useLeagueMutations'

export interface UpdateLeagueData {
  id: number
  data: LeagueFormPayload
}

/** Shared league-edit submit handler used by leagues.vue and league/[id].vue. */
export function useLeagueUpdate(onSuccess: () => void) {
  const { updateLeague: updateLeagueMutation } = useLeagueMutations()
  const toast = useToast()
  const { t } = useI18n()

  async function updateLeague({ id, data }: UpdateLeagueData) {
    try {
      await updateLeagueMutation.mutateAsync({ id, data })
    } catch (err) {
      toast.add({
        title: t('league.toast.updateErrorTitle'),
        description: toErrorMessage(err, t('league.toast.updateErrorFallback')),
        color: 'error'
      })
      return
    }

    toast.add({
      title: t('league.toast.updatedTitle'),
      description: t('league.toast.updatedDescription'),
      color: 'success'
    })
    onSuccess()
  }

  return { updateLeague }
}
