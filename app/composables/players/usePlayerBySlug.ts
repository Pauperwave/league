// app/composables/usePlayerBySlug.ts
import { slugify } from '~/utils/slug'
import type { Player } from '#shared/utils/types'

export function usePlayerBySlug(slug: string) {
  const playersStore = usePlayerStore()

  const player = computed<Player | undefined>(() => {
    return playersStore.players.find(p =>
      slugify(`${p.player_name ?? ''} ${p.player_surname ?? ''}`.trim()) === slug
    )
  })

  const playerId = computed(() => player.value?.player_id)

  // Fetch players immediately so it runs on both server and client (SSR-safe)
  if (!playersStore.initialized) {
    playersStore.fetchPlayers()
  }

  return { player, playerId }
}
