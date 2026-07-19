// app\composables\players\usePlayerMutations.ts
// Pinia Colada mutations for player create/update (ADR-015): $fetch to the
// BFF endpoints (ADR-013), then invalidate the players list so the cache
// refetches server truth. Toasts stay at the call sites. There is no player
// delete — deliberately, players are referenced everywhere.
import type { Player, NewPlayer } from '#shared/utils/types'

/** The update payload emitted by CreatePlayerModal. */
export interface PlayerUpdatePayload {
  id: number
  data: NewPlayer
}

export function usePlayerMutations() {
  const queryCache = useQueryCache()
  const invalidate = () => queryCache.invalidateQueries({ key: PLAYERS_KEY })

  const createPlayer = useMutation({
    mutation: (payload: NewPlayer) =>
      $fetch('/api/players/create', {
        method: 'POST',
        body: {
          player_name: payload.player_name,
          player_surname: payload.player_surname,
          is_active: payload.is_active,
          formats_played: payload.formats_played
        },
      }),
    onSettled: invalidate,
  })

  // Template-literal URLs are cast to string: matching them against Nitro's
  // typed route union blows the TS depth limit in the IDE ("Excessive stack
  // depth") as the route count grows — the explicit generic keeps the
  // response typed instead.
  const updatePlayer = useMutation({
    mutation: ({ id, data }: PlayerUpdatePayload) =>
      $fetch<{ player: Player }>(`/api/players/${id}/update` as string, {
        method: 'POST',
        body: {
          player_name: data.player_name,
          player_surname: data.player_surname,
          is_active: data.is_active,
          formats_played: data.formats_played
        },
      }),
    onSettled: invalidate,
  })

  return { createPlayer, updatePlayer }
}
