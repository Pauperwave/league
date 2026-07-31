// app\composables\avoid-pairs\useAvoidPairsMutations.ts
// Pinia Colada mutations for avoid-pairs (ADR-015): $fetch to the BFF
// endpoints (ADR-013), then invalidate the avoid-pairs list so the cache
// refetches server truth.
export interface AvoidPairPayload {
  playerA: number
  playerB: number
}

export function useAvoidPairsMutations() {
  const queryCache = useQueryCache()
  const invalidate = () => queryCache.invalidateQueries({ key: AVOID_PAIRS_KEY })

  const addAvoidPair = useMutation({
    mutation: (payload: AvoidPairPayload) =>
      $fetch('/api/avoid-pairs/create', { method: 'POST', body: payload }),
    onSettled: invalidate,
  })

  const removeAvoidPair = useMutation({
    mutation: (payload: AvoidPairPayload) =>
      $fetch('/api/avoid-pairs/delete', { method: 'POST', body: payload }),
    onSettled: invalidate,
  })

  return { addAvoidPair, removeAvoidPair }
}
