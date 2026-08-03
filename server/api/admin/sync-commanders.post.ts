// server\api\admin\sync-commanders.post.ts
// Incremental resync: fetches commander-eligible cards from Scryfall (paper,
// English, legal:commander — this already covers Backgrounds too, they can
// occupy the commander zone as a second commander), diffs against
// mtg_commanders, and inserts ONLY the rows that are new. Never re-touches
// or re-fetches images/text for cards already synced, and never clobbers a
// row a previous session may have manually corrected (see docs/PROGRESS.md
// ADR-016, the "Choose a Background" partner_type fix).
//
// The common-case fetch is scoped with `date>=<max known released_at>`
// (mtg_commanders.released_at, added specifically for this) so a routine
// resync — catalog only ever a few weeks stale — hits Scryfall for just the
// cards released since the last sync, instead of paginating the entire
// ~3600-card commander-eligible result set. `released_at` starts out NULL
// for every pre-existing row (the column didn't exist before), so the first
// run after the migration (or if too many rows are still un-backfilled) does
// one full unscoped fetch instead: it backfills released_at for the existing
// catalog AND detects new cards in the same pass, so it never has to be run
// twice. Every run after that is date-scoped.
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

const SCRYFALL_BASE_QUERY = 'is:commander lang:en -is:digital legal:commander'
const SCRYFALL_USER_AGENT = 'MagicTheGatheringLeague/1.0 (commander catalog sync)'
// Two consecutive all-known pages before stopping, in case a release-date tie
// splits an already-known and a still-unknown card across a page boundary.
const CONSECUTIVE_KNOWN_PAGES_TO_STOP = 2
// Above this many un-backfilled rows, a full unscoped fetch (which also
// backfills released_at) is cheaper than trusting a date filter built from a
// catalog that's still mostly missing it. Below it, a handful of permanent
// stragglers (e.g. a card since removed from is:commander) can't force every
// future run back into full-fetch mode forever.
const BACKFILL_THRESHOLD = 50

function buildSearchUrl(dateFrom?: string | null): string {
  const q = dateFrom ? `${SCRYFALL_BASE_QUERY} date>=${dateFrom}` : SCRYFALL_BASE_QUERY
  const params = new URLSearchParams({ q, unique: 'cards', order: 'released', dir: 'desc' })
  return `https://api.scryfall.com/cards/search?${params.toString()}`
}

interface ScryfallImageUris {
  normal?: string
  large?: string
  art_crop?: string
}

interface ScryfallCardFace {
  image_uris?: ScryfallImageUris
  mana_cost?: string
  type_line?: string
  oracle_text?: string
}

interface ScryfallCard {
  id: string
  name: string
  lang: string
  digital: boolean
  layout: string
  legalities: { commander?: string }
  released_at?: string
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallCardFace[]
  mana_cost?: string
  cmc?: number
  color_identity?: string[]
  type_line?: string
  keywords?: string[]
  oracle_text?: string
  edhrec_rank?: number
  scryfall_uri?: string
}

interface ScryfallSearchPage {
  data: ScryfallCard[]
  has_more: boolean
  next_page?: string
}

interface FetchResult {
  cards: ScryfallCard[]
  scanned: number
}

/**
 * Paginates a Scryfall search. When `earlyStop` is true, stops once
 * `CONSECUTIVE_KNOWN_PAGES_TO_STOP` pages in a row contain nothing not
 * already in `existing` — only safe when the query is already date-scoped to
 * "recent", never during a full unscoped backfill pass (which needs every
 * card to correctly backfill released_at).
 */
async function fetchCommanderCardsPaginated(
  startUrl: string,
  existing: ExistingCatalog,
  earlyStop: boolean
): Promise<FetchResult> {
  const cards: ScryfallCard[] = []
  let scanned = 0
  let consecutiveKnownPages = 0
  let url: string | undefined = startUrl

  while (url) {
    const page: ScryfallSearchPage = await $fetch(url, {
      headers: { 'User-Agent': SCRYFALL_USER_AGENT, Accept: 'application/json' }
    })
    scanned += page.data.length
    cards.push(...page.data)

    if (earlyStop) {
      const pageHasNew = page.data.some(card => !existing.scryfallIds.has(card.id) && !existing.names.has(card.name))
      consecutiveKnownPages = pageHasNew ? 0 : consecutiveKnownPages + 1
      if (consecutiveKnownPages >= CONSECUTIVE_KNOWN_PAGES_TO_STOP) break
    }

    url = page.has_more ? page.next_page : undefined
    // Scryfall's API etiquette asks for 50-100ms between requests.
    if (url) await new Promise(resolve => setTimeout(resolve, 100))
  }

  return { cards, scanned }
}

interface ExistingCatalog {
  scryfallIds: Set<string>
  names: Set<string>
  maxReleasedAt: string | null
  rowsNeedingReleasedAt: { scryfallId: string, cardName: string }[]
}

// `mtg_commanders` has unique constraints on BOTH scryfall_id and card_name —
// a new printing of an already-catalogued card (same name, different id,
// e.g. a reprint) must be skipped by name too, or the insert fails.
async function fetchExistingCatalog(
  supabase: ReturnType<typeof serverSupabaseServiceRole<Database>>
): Promise<ExistingCatalog> {
  const scryfallIds = new Set<string>()
  const names = new Set<string>()
  const rowsNeedingReleasedAt: { scryfallId: string, cardName: string }[] = []
  let maxReleasedAt: string | null = null
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('mtg_commanders')
      .select('scryfall_id, card_name, released_at')
      .range(from, from + pageSize - 1)

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message
      })
    }
    if (!data || data.length === 0) break

    for (const row of data) {
      scryfallIds.add(row.scryfall_id)
      names.add(row.card_name)
      if (row.released_at) {
        if (!maxReleasedAt || row.released_at > maxReleasedAt) maxReleasedAt = row.released_at
      } else {
        rowsNeedingReleasedAt.push({ scryfallId: row.scryfall_id, cardName: row.card_name })
      }
    }
    if (data.length < pageSize) break
    from += pageSize
  }

  return { scryfallIds, names, maxReleasedAt, rowsNeedingReleasedAt }
}

/** One-time (per row) fill of released_at for rows synced before the column
 * existed — matched by scryfall_id against the full fetch already in hand, no extra Scryfall requests. */
async function backfillReleasedDates(
  supabase: ReturnType<typeof serverSupabaseServiceRole<Database>>,
  rowsNeedingReleasedAt: ExistingCatalog['rowsNeedingReleasedAt'],
  allFetchedCards: ScryfallCard[]
): Promise<number> {
  if (rowsNeedingReleasedAt.length === 0) return 0

  // Matched by name, not scryfall_id: a pre-existing row's stored id can point
  // to a printing this fetch's `-is:digital` filter excludes (e.g. an old
  // MTGO-only reprint), in which case Scryfall's `unique=cards` picks a
  // different (paper) printing — different id, same card — as the
  // representative. The row's own scryfall_id is left untouched either way.
  const releasedAtByName = new Map(allFetchedCards.map(card => [card.name, card.released_at]))
  const rowsToUpdate = rowsNeedingReleasedAt
    .map(row => ({
      scryfall_id: row.scryfallId,
      card_name: row.cardName,
      released_at: releasedAtByName.get(row.cardName)
    }))
    .filter((row): row is { scryfall_id: string, card_name: string, released_at: string } => !!row.released_at)

  const chunkSize = 500
  for (let i = 0; i < rowsToUpdate.length; i += chunkSize) {
    const chunk = rowsToUpdate.slice(i, i + chunkSize)
    const { error } = await supabase.from('mtg_commanders').upsert(chunk, { onConflict: 'scryfall_id' })
    if (error) {
      console.error('[api/sync-commanders] released_at backfill failed', error)
      throw createError({
        statusCode: 500,
        statusMessage: error.message
      })
    }
  }

  return rowsToUpdate.length
}

function partnerTypeFor(card: ScryfallCard, typeLine: string, keywords: string[]): string | null {
  if (keywords.includes('Partner with')) return 'partner_with'
  if (keywords.includes('Choose a background')) return 'background_commander'
  if (keywords.includes("Doctor's companion")) return 'doctors_companion'
  if (/friends forever/i.test(card.oracle_text ?? '')) return 'friends_forever'
  if (typeLine.includes('Time Lord Doctor')) return 'doctor'
  if (keywords.includes('Partner')) return 'partner'
  if (typeLine.includes('Enchantment') && typeLine.includes('Background')) return 'background'
  return null
}

function partnerTargetName(card: ScryfallCard): string | null {
  const match = /Partner with ([^(]+)\(/.exec(card.oracle_text ?? '')
  return match?.[1]?.trim() ?? null
}

interface MappedRow {
  scryfall_id: string
  card_name: string
  image_url: string | null
  large_image_url: string | null
  art_crop_url: string | null
  back_image_url: string | null
  back_large_image_url: string | null
  back_art_crop_url: string | null
  mana_cost: string | null
  back_mana_cost: string | null
  cmc: number
  color_identity: string[]
  type_line: string | null
  back_type_line: string | null
  keywords: string[]
  oracle_text: string | null
  back_oracle_text: string | null
  partner_type: string | null
  partner_group_tag: null
  edhrec_rank: number | null
  layout: string
  is_double_faced: boolean
  scryfall_url: string | null
  released_at: string | null
  last_synced_at: string
  partnerTargetName: string | null
}

function mapCard(card: ScryfallCard): MappedRow {
  const frontFace = card.card_faces?.[0]
  const backFace = card.card_faces?.[1]
  const typeLine = card.type_line ?? frontFace?.type_line ?? ''
  const keywords = card.keywords ?? []

  return {
    scryfall_id: card.id,
    card_name: card.name,
    image_url: card.image_uris?.normal ?? frontFace?.image_uris?.normal ?? null,
    large_image_url: card.image_uris?.large ?? frontFace?.image_uris?.large ?? null,
    art_crop_url: card.image_uris?.art_crop ?? frontFace?.image_uris?.art_crop ?? null,
    back_image_url: backFace?.image_uris?.normal ?? null,
    back_large_image_url: backFace?.image_uris?.large ?? null,
    back_art_crop_url: backFace?.image_uris?.art_crop ?? null,
    mana_cost: card.mana_cost ?? frontFace?.mana_cost ?? null,
    back_mana_cost: backFace?.mana_cost ?? null,
    cmc: card.cmc ?? 0,
    color_identity: card.color_identity ?? [],
    type_line: typeLine || null,
    back_type_line: backFace?.type_line ?? null,
    keywords,
    oracle_text: card.oracle_text ?? frontFace?.oracle_text ?? null,
    back_oracle_text: backFace?.oracle_text ?? null,
    partner_type: partnerTypeFor(card, typeLine, keywords),
    partner_group_tag: null,
    edhrec_rank: card.edhrec_rank ?? null,
    layout: card.layout,
    is_double_faced: (card.card_faces?.length ?? 0) > 1,
    scryfall_url: card.scryfall_uri ?? null,
    released_at: card.released_at ?? null,
    last_synced_at: new Date().toISOString(),
    partnerTargetName: partnerTargetName(card),
  }
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole<Database>(event)

  console.log('[api/sync-commanders] fetching existing catalog')
  const existing = await fetchExistingCatalog(supabase)

  const needsFullFetch = existing.maxReleasedAt === null || existing.rowsNeedingReleasedAt.length > BACKFILL_THRESHOLD
  const startUrl = needsFullFetch ? buildSearchUrl() : buildSearchUrl(existing.maxReleasedAt)

  console.log('[api/sync-commanders] fetching commander-eligible cards from Scryfall', {
    mode: needsFullFetch ? 'full (backfilling released_at)' : 'date-scoped',
    since: needsFullFetch ? null : existing.maxReleasedAt,
    rowsNeedingReleasedAt: existing.rowsNeedingReleasedAt.length
  })
  const { cards: fetchedCards, scanned } = await fetchCommanderCardsPaginated(startUrl, existing, !needsFullFetch)

  if (needsFullFetch) {
    const backfilled = await backfillReleasedDates(supabase, existing.rowsNeedingReleasedAt, fetchedCards)
    console.log('[api/sync-commanders] backfilled released_at', { updated: backfilled, total: existing.rowsNeedingReleasedAt.length })
  }

  // mtg_commanders is unique on card_name too — dedupe same-name printings
  // within this batch (e.g. a handful of Un-set/promo variants).
  const seenNames = new Set<string>()
  const newCards = fetchedCards.filter((card) => {
    if (existing.scryfallIds.has(card.id) || existing.names.has(card.name)) return false
    if (seenNames.has(card.name)) return false
    seenNames.add(card.name)
    return true
  })

  console.log('[api/sync-commanders] diff computed', {
    scanned,
    existingIds: existing.scryfallIds.size,
    new: newCards.length
  })

  if (newCards.length === 0) {
    return {
      added: 0,
      checked: scanned,
      cards: []
    }
  }

  const mapped = newCards.map(mapCard)

  // name -> scryfall_id for every card involved (existing rows aren't needed
  // here since "Partner with" always targets a card printed in the same
  // release pass as its partner — both sides are in `mapped`).
  const idByName = new Map(mapped.map(row => [row.card_name, row.scryfall_id]))

  const insertRows = mapped.map(({ partnerTargetName: targetName, ...row }) => ({
    ...row,
    partner_with_scryfall_id: targetName ? idByName.get(targetName) ?? null : null,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('mtg_commanders')
    .insert(insertRows)
    .select('card_name')

  if (insertError) {
    console.error('[api/sync-commanders] insert failed', insertError)
    throw createError({
      statusCode: 500,
      statusMessage: insertError.message
    })
  }

  console.log('[api/sync-commanders] added new commanders', { count: inserted?.length ?? 0 })

  return {
    added: inserted?.length ?? 0,
    checked: scanned,
    cards: (inserted ?? []).map(row => row.card_name),
  }
})
