// app\composables\commanders\useCommanderCards.ts
import * as v from 'valibot'
import type { Database } from '#shared/utils/types/database'

// ─── Schema ───────────────────────────────────────────────────────────────────

const PartnerTypeSchema = v.nullable(v.picklist([
  'partner',
  'partner_with',
  'partner_group',
  'friends_forever',
  'doctor',
  'doctors_companion',
  'background_commander',
  'background',
]))

const CommanderCardSchema = v.object({
  scryfallId: v.string(),
  scryfallUrl: v.nullable(v.string()),
  name: v.string(),
  imageUrl: v.nullable(v.string()),
  largeImageUrl: v.nullable(v.string()),
  artCropUrl: v.nullable(v.string()),
  manaCost: v.nullable(v.string()),
  cmc: v.number(),
  colorIdentity: v.array(v.string()),
  typeLine: v.nullable(v.string()),
  keywords: v.array(v.string()),
  oracleText: v.nullable(v.string()),
  partnerType: PartnerTypeSchema,
  partnerWithScryfallId: v.nullable(v.string()),
  partnerGroupTag: v.nullable(v.string()),
  edhrecRank: v.nullable(v.number()),
  isDoubleFaced: v.boolean(),
  backImageUrl: v.nullable(v.string()),
  backLargeImageUrl: v.nullable(v.string()),
  backOracleText: v.nullable(v.string()),
  backManaCost: v.nullable(v.string()),
  backTypeLine: v.nullable(v.string()),
})

// ─── Tipi inferiti dallo schema ───────────────────────────────────────────────

export type PartnerType = NonNullable<v.InferOutput<typeof PartnerTypeSchema>>
export type CommanderCard = v.InferOutput<typeof CommanderCardSchema>

// ─── Mapping + validazione ────────────────────────────────────────────────────

const FIELD_DEFAULTS: Record<string, unknown> = {
  scryfallUrl: null,
  imageUrl: null,
  largeImageUrl: null,
  artCropUrl: null,
  manaCost: null,
  cmc: 0,
  colorIdentity: [],
  typeLine: null,
  keywords: [],
  oracleText: null,
  partnerType: null,
  partnerWithScryfallId: null,
  partnerGroupTag: null,
  edhrecRank: null,
  isDoubleFaced: false,
  backImageUrl: null,
  backLargeImageUrl: null,
  backOracleText: null,
  backManaCost: null,
  backTypeLine: null,
}

const SNAKE_TO_CAMEL: Record<string, string> = {
  scryfall_id: 'scryfallId',
  scryfall_url: 'scryfallUrl',
  card_name: 'name',
  image_url: 'imageUrl',
  large_image_url: 'largeImageUrl',
  art_crop_url: 'artCropUrl',
  mana_cost: 'manaCost',
  cmc: 'cmc',
  color_identity: 'colorIdentity',
  type_line: 'typeLine',
  keywords: 'keywords',
  oracle_text: 'oracleText',
  partner_type: 'partnerType',
  partner_with_scryfall_id: 'partnerWithScryfallId',
  partner_group_tag: 'partnerGroupTag',
  edhrec_rank: 'edhrecRank',
  is_double_faced: 'isDoubleFaced',
  back_image_url: 'backImageUrl',
  back_large_image_url: 'backLargeImageUrl',
  back_oracle_text: 'backOracleText',
  back_mana_cost: 'backManaCost',
  back_type_line: 'backTypeLine',
}

export function mapToCommanderCard(row: Record<string, unknown>): CommanderCard {
  const raw: Record<string, unknown> = {}

  for (const [snakeKey, camelKey] of Object.entries(SNAKE_TO_CAMEL)) {
    const value = row[snakeKey]
    raw[camelKey] = value !== undefined ? value : FIELD_DEFAULTS[camelKey]
  }

  return v.parse(CommanderCardSchema, raw)
}

// ─── Batch fetch ──────────────────────────────────────────────────────────────

export async function fetchCommandersByNames(
  cardNames: string[],
  supabase: ReturnType<typeof useSupabaseClient<Database>>
): Promise<Map<string, CommanderCard>> {
  const result = new Map<string, CommanderCard>()
  if (cardNames.length === 0) return result

  const uniqueNames = [...new Set(cardNames.filter(Boolean))]

  const { data, error } = await supabase
    .from('mtg_commanders')
    .select('*')
    .in('card_name', uniqueNames)

  if (error || !data) {
    console.error('[useCommanderCards] Batch fetch error:', error?.message)
    return result
  }

  for (const row of data) {
    try {
      result.set(row.card_name, mapToCommanderCard(row))
    } catch (err) {
      console.error(`[useCommanderCards] Validation error for "${row.card_name}":`, err)
    }
  }

  return result
}

/** Query key for a batch commander-card lookup by name set (decks browse sort). */
export const COMMANDERS_BY_NAMES_KEY = ['commanders-by-names']

/**
 * Batch commander-card lookup for a set of names, gated by `enabled` (e.g.
 * only fetched once a sort mode that needs card data is selected). Colada
 * caches by the sorted name set, so re-selecting the same sort never refetches.
 */
export function useCommandersByNamesQuery(
  cardNames: MaybeRefOrGetter<string[]>,
  enabled: MaybeRefOrGetter<boolean> = true
) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: () => [...COMMANDERS_BY_NAMES_KEY, [...new Set(toValue(cardNames))].sort().join(',')],
    enabled: () => toValue(enabled) && toValue(cardNames).length > 0,
    query: () => fetchCommandersByNames(toValue(cardNames), supabase),
  })
}

// ─── Composable ───────────────────────────────────────────────────────────────

/** Query key for a single commander card lookup by name. */
export const COMMANDER_CARD_KEY = ['commander-card']

export async function fetchCommanderByName(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  cardName: string
): Promise<CommanderCard | null> {
  const { data, error } = await supabase
    .from('mtg_commanders')
    .select('*')
    .eq('card_name', cardName)
    .single()

  if (error || !data) {
    console.error(`[useCommanderCards] Commander not found: "${cardName}"`, error?.message)
    return null
  }

  return mapToCommanderCard(data)
}

function useCommanderCardQuery(cardName: MaybeRefOrGetter<string | null | undefined>) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: () => [...COMMANDER_CARD_KEY, toValue(cardName) ?? 'none'],
    enabled: () => !!toValue(cardName),
    query: () => {
      const name = toValue(cardName)
      return name ? fetchCommanderByName(supabase, name) : Promise.resolve(null)
    },
  })
}

/** A deck's commander card(s) from `mtg_commanders`, keyed reactively by name (Colada, ADR-015). */
export function useCommanderCards(
  commander1Name: MaybeRefOrGetter<string | null | undefined>,
  commander2Name: MaybeRefOrGetter<string | null | undefined>
) {
  const { data: commander1Data, isLoading: loading1, error: error1 } = useCommanderCardQuery(commander1Name)
  const { data: commander2Data, isLoading: loading2, error: error2 } = useCommanderCardQuery(commander2Name)

  const loading = computed(() => loading1.value || loading2.value)
  const error = computed(() => error1.value ?? error2.value ?? null)

  return { commander1Data, commander2Data, loading, error }
}

export function getArtCrop(card: CommanderCard | null | undefined): string | null {
  return card?.artCropUrl ?? null
}
