// app\composables\ruleset\useRulesetMutations.ts
// Pinia Colada mutations for ruleset CRUD (ADR-015): $fetch to the BFF
// endpoints (ADR-013), then invalidate the rulesets list so the cache
// refetches server truth. Toasts stay at the call sites.
import type { Ruleset } from '#shared/utils/types'

/** The form payload emitted by RulesetFormModal (DB column names). */
export type RulesetFormPayload = Omit<Ruleset, 'ruleset_id'>

export function useRulesetMutations() {
  const queryCache = useQueryCache()
  const invalidate = () => queryCache.invalidateQueries({ key: RULESETS_KEY })

  const createRuleset = useMutation({
    mutation: (payload: RulesetFormPayload) =>
      $fetch('/api/rulesets/create', { method: 'POST', body: payload }),
    onSettled: invalidate,
  })

  // Template-literal URLs are cast to string: matching them against Nitro's
  // typed route union blows the TS depth limit in the IDE ("Excessive stack
  // depth") as the route count grows — the explicit generic keeps the
  // response typed instead.
  const updateRuleset = useMutation({
    mutation: ({ id, data }: { id: number, data: RulesetFormPayload }) =>
      $fetch<{ ruleset: Ruleset }>(`/api/rulesets/${id}/update` as string, { method: 'POST', body: data }),
    onSettled: invalidate,
  })

  const deleteRuleset = useMutation({
    mutation: (id: number) =>
      $fetch<{ deleted: boolean }>(`/api/rulesets/${id}/delete` as string, { method: 'POST' }),
    onSettled: invalidate,
  })

  return { createRuleset, updateRuleset, deleteRuleset }
}
