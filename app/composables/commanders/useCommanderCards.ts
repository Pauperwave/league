// app/composables/useCommanderCards.ts
import { useI18n } from 'vue-i18n'
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
  backArtCropUrl: v.nullable(v.string()),
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
  backArtCropUrl: null,
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

// ─── Composable ───────────────────────────────────────────────────────────────

export function useCommanderCards(
  commander1Name: MaybeRefOrGetter<string | null | undefined>,
  commander2Name: MaybeRefOrGetter<string | null | undefined>
) {
  const supabase = useSupabaseClient()
  const { t } = useI18n()
  const commander1Data = ref<CommanderCard | null>(null)
  const commander2Data = ref<CommanderCard | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCommanderByName(cardName: string): Promise<CommanderCard | null> {
    if (!cardName) return null

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

  async function fetchAllData() {
    const name1 = toValue(commander1Name)
    if (!name1) return

    const name2 = toValue(commander2Name)

    loading.value = true
    error.value = null

    try {
      const [data1, data2] = await Promise.all([
        fetchCommanderByName(name1),
        name2 ? fetchCommanderByName(name2) : Promise.resolve(null)
      ])
      commander1Data.value = data1
      commander2Data.value = data2
    } catch (err) {
      error.value = err instanceof Error ? err.message : t('commander.cardLoadError')
      console.error('[useCommanderCards] Error:', err)
    } finally {
      loading.value = false
    }
  }

  return { commander1Data, commander2Data, loading, error, fetchAllData }
}

export function getArtCrop(card: CommanderCard | null): string | null {
  return card?.artCropUrl ?? null
}
