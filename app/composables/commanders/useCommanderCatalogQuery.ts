// app\composables\commanders\useCommanderCatalogQuery.ts
import type { Database } from '#shared/utils/types/database'

export interface CommanderCatalogRow {
  name: string
  partnerType: string | null
  keywords: string[]
  partnerWithScryfallId: string | null
  manaCost: string | null
  edhrecRank: number | null
  imageUrl: string | null
}

export const COMMANDER_CATALOG_KEY = ['commander-catalog']

// Un mese — i dati dei comandanti cambiano solo dopo un resync Scryfall o
// una correzione manuale (es. i 31 "Choose a Background" corretti il
// 2026-07-20). Sia staleTime (quanto resta "fresco" prima di un refetch in
// background) SIA gcTime (quanto resta in cache anche da inattivo prima di
// essere scartato) vanno impostati alla stessa durata — il plugin
// cache-persister persiste solo ciò che è ancora nella cache di Colada: con
// il solo staleTime aumentato, il gcTime di default (breve) avrebbe comunque
// scartato la voce e vanificato la persistenza mensile.
const CATALOG_CACHE_TIME = 30 * 24 * 60 * 60 * 1000

interface CommanderCatalogRawRow {
  card_name: string
  partner_type: string | null
  keywords: string[] | null
  partner_with_scryfall_id: string | null
  mana_cost: string | null
  edhrec_rank: number | null
  image_url: string | null
}

async function fetchCommanderCatalog(
  supabase: ReturnType<typeof useSupabaseClient<Database>>
): Promise<CommanderCatalogRow[]> {
  const { data, error } = await supabase.rpc('get_commander_catalog')
  if (error) throw error

  return ((data ?? []) as unknown as CommanderCatalogRawRow[]).map(row => ({
    name: row.card_name,
    partnerType: row.partner_type,
    keywords: row.keywords ?? [],
    partnerWithScryfallId: row.partner_with_scryfall_id,
    manaCost: row.mana_cost,
    edhrecRank: row.edhrec_rank,
    imageUrl: row.image_url,
  }))
}

/** L'intero catalogo comandanti — cache condivisa via Colada, persistita in
 * localStorage dal plugin cache-persister (vedi colada.options.ts). */
export function useCommanderCatalogQuery() {
  const supabase = useSupabaseClient<Database>()

  return useQuery({
    key: () => COMMANDER_CATALOG_KEY,
    query: () => fetchCommanderCatalog(supabase),
    staleTime: CATALOG_CACHE_TIME,
    gcTime: CATALOG_CACHE_TIME,
  })
}
