// app\composables\deck\useDeckMutations.ts
// Pinia Colada mutations for deck CRUD (ADR-015): $fetch to the BFF
// endpoints (ADR-013), then invalidate the decks list and the per-player
// usage queries so the caches refetch server truth. Toasts stay at the call
// sites. The delete endpoint answers 409 when the deck was played in an
// event — map it with isConflictError.
import type { CommanderDeck } from '#shared/utils/types'

/** The payload emitted by DeckCreateModal (DB column names). */
export interface DeckFormPayload {
  player_id: number
  commander_1_name: string
  commander_2_name: string | null
  companion_name: string | null
  is_borrowed: boolean
  lender_id: number | null
}

export function useDeckMutations() {
  const queryCache = useQueryCache()
  const invalidate = () => {
    queryCache.invalidateQueries({ key: DECKS_KEY })
    queryCache.invalidateQueries({ key: DECK_USAGE_KEY })
  }

  const createDeck = useMutation({
    mutation: (payload: DeckFormPayload) =>
      $fetch('/api/decks/create', { method: 'POST', body: payload }),
    onSettled: invalidate,
  })

  // Template-literal URLs are cast to string: matching them against Nitro's
  // typed route union blows the TS depth limit in the IDE ("Excessive stack
  // depth") as the route count grows — the explicit generic keeps the
  // response typed instead.
  const updateDeck = useMutation({
    mutation: ({ id, updates }: { id: number, updates: Partial<DeckFormPayload> }) =>
      $fetch<{ deck: CommanderDeck }>(`/api/decks/${id}/update` as string, { method: 'POST', body: updates }),
    onSettled: invalidate,
  })

  const deleteDeck = useMutation({
    mutation: (id: number) =>
      $fetch<{ deleted: boolean }>(`/api/decks/${id}/delete` as string, { method: 'POST' }),
    onSettled: invalidate,
  })

  return { createDeck, updateDeck, deleteDeck }
}
