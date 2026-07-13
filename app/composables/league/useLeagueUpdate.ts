// app\composables\league\useLeagueUpdate.ts
import { useI18n } from 'vue-i18n'

export interface UpdateLeagueData {
  id: number
  data: {
    name: string
    startsAt: string | null
    endsAt: string | null
    rulesetId: number | null
  }
}

/** Shared league-edit submit handler used by leagues.vue and league/[id].vue. */
export function useLeagueUpdate(onSuccess: () => void) {
  const leagueStore = useLeagueStore()
  const toast = useToast()
  const { t } = useI18n()

  async function updateLeague({ id, data }: UpdateLeagueData) {
    const result = await leagueStore.updateLeague(id, {
      name: data.name,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      ruleset_id: data.rulesetId,
    })

    if (!result.success) {
      toast.add({
        title: t('league.toast.updateErrorTitle'),
        description: result.error || t('league.toast.updateErrorFallback'),
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
