// server\utils\requestValidation.ts
// Generic request scaffolding shared by the BFF endpoints (ADR-013): route id
// params and body validation with the uniform 400 error shape. Auth is not
// handled here — server/middleware/api-auth.ts guards every /api route.
import * as v from 'valibot'
import type { H3Event } from 'h3'
import { Constants } from '#shared/utils/types/database'

/**
 * Parse a positive-integer id from the route params, throwing the uniform
 * 400 on anything else ("tournamentId" → "Invalid event id").
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
  validTournaments: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
  // Only written by the update endpoint (create always hardcodes 'scheduled')
  // — see LeagueFormModal.vue's status USelect, only shown while editing.
  // Optional so create callers (including the E2E specs) aren't forced to
  // pass a value that create ignores anyway.
  status: v.optional(v.picklist(['scheduled', 'active', 'ended']), 'scheduled'),
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
})

/**
 * Body schema shared by the player create/update endpoints.
 */
export const playerFormBodySchema = v.object({
  player_name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  player_surname: v.pipe(v.string(), v.trim(), v.minLength(1)),
  is_active: v.optional(v.boolean(), true),
  formats_played: v.optional(v.nullable(v.array(v.picklist(Constants.public.Enums.mtg_formats))), null),
})

/**
 * Body schema shared by the deck create/update endpoints (update validates
 * against its partial).
 */
export const deckFormBodySchema = v.object({
  player_id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  commander_1_name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  commander_2_name: v.nullish(v.string()),
  companion_name: v.nullish(v.string()),
  is_borrowed: v.optional(v.boolean(), false),
  lender_id: v.nullish(v.pipe(v.number(), v.integer(), v.minValue(1))),
  bracket_level: v.nullish(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5))),
})

/**
 * Body schema shared by the tournament create/update endpoints (update validates
 * against its partial).
 */
export const tournamentFormBodySchema = v.object({
  tournament_name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  league_id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  tournament_datetime: v.nullish(v.string()),
  tournament_round_number: v.pipe(v.number(), v.integer(), v.minValue(1)),
  tournament_round_duration: v.pipe(v.number(), v.integer(), v.minValue(1)),
  tournament_registration_open: v.optional(v.boolean(), true),
  tournament_format: v.optional(v.picklist(Constants.public.Enums.mtg_formats), 'Commander'),
})

/**
 * Body schema shared by the avoid-pairs create/delete endpoints — a pair of
 * distinct player ids (order doesn't matter, the endpoint normalizes it).
 */
export const avoidPairBodySchema = v.pipe(
  v.object({
    playerA: v.pipe(v.number(), v.integer(), v.minValue(1)),
    playerB: v.pipe(v.number(), v.integer(), v.minValue(1)),
  }),
  v.check(input => input.playerA !== input.playerB, 'playerA and playerB must be different players'),
)

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
