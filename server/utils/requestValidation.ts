// server\utils\requestValidation.ts
// Generic request scaffolding shared by the BFF endpoints (ADR-013): route id
// params and body validation with the uniform 400 error shape. Auth is not
// handled here — server/middleware/api-auth.ts guards every /api route.
import * as v from 'valibot'
import type { H3Event } from 'h3'

/**
 * Parse a positive-integer id from the route params, throwing the uniform
 * 400 on anything else ("eventId" → "Invalid event id").
 */
export function requireIdParam(event: H3Event, name: string): number {
  const id = Number(getRouterParam(event, name))
  if (!Number.isInteger(id) || id < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid ${name.replace(/Id$/, '')} id`
    })
  }
  return id
}

/**
 * Body schema shared by the register/unregister endpoints: a non-empty list
 * of player ids.
 */
export const playerIdsBodySchema = v.object({
  playerIds: v.pipe(
    v.array(v.pipe(v.number(), v.integer(), v.minValue(1))),
    v.minLength(1),
  ),
})

/**
 * Body schema shared by the league create/update endpoints — the form
 * payload emitted by LeagueFormModal.
 */
export const leagueFormBodySchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  startsAt: v.nullable(v.string()),
  endsAt: v.nullable(v.string()),
  rulesetId: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
})

/**
 * Body schema shared by the ruleset create/update endpoints — the form
 * payload emitted by RulesetFormModal (DB column names, scores nullable).
 */
export const rulesetFormBodySchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  rule_set_partecipation: v.nullable(v.number()),
  rule_set_kill: v.nullable(v.number()),
  rule_set_brew: v.nullable(v.number()),
  rule_set_play: v.nullable(v.number()),
  rule_set_rank1: v.nullable(v.number()),
  rule_set_rank2: v.nullable(v.number()),
  rule_set_rank3: v.nullable(v.number()),
  rule_set_rank4: v.nullable(v.number()),
  rule_set_valid_events: v.nullable(v.number()),
})

/**
 * Read the request body and validate it against a valibot schema, throwing
 * the uniform 400 on malformed input.
 */
export async function requireValidBody<TSchema extends v.GenericSchema>(
  event: H3Event,
  schema: TSchema,
): Promise<v.InferOutput<TSchema>> {
  const parsed = v.safeParse(schema, await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }
  return parsed.output
}
