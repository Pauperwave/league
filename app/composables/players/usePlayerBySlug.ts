// app\composables\players\usePlayerBySlug.ts
import type { Player } from '#shared/utils/types'

export function usePlayerBySlug(slug: string) {
  // Colada cache of all players (ADR-015) — auto-fetched, SSR-prefetched
  const { data: players } = usePlayersQuery()

  const player = computed<Player | undefined>(() => {
    return (players.value ?? []).find(p =>
      slugify(`${p.player_name ?? ''} ${p.player_surname ?? ''}`.trim()) === slug
    )
  })

  const playerId = computed(() => player.value?.player_id)

  return { player, playerId }
}
