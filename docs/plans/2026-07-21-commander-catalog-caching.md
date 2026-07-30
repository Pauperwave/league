# Cache del catalogo comandanti (whitelist + ricerca) lato client

## Contesto

Indagando sul bug "Candlekeep Sage non si trova come Background" abbiamo scoperto che
`useCommanderWhitelists.loadAllLists()` caricava tutte le righe di `mtg_commanders`
(2986 righe) senza paginazione — PostgREST tronca silenziosamente a 1000 righe,
quindi ~2000 comandanti (incluse molte Background) erano invisibili alla whitelist
usata per validare il secondo comandante. Abbiamo già corretto questo con un loop
`.range()` lato client, ma resta il problema di fondo: quella funzione viene
richiamata da `CommanderModal.vue` in `onMounted()`, quindi **rifà tutte le query
ogni volta che si apre la modale comandante**, e `useCommanderSearch.ts` interroga
il DB **ad ogni tasto premuto** durante l'autocomplete.

L'utente ha già risolto lo stesso problema in un progetto React sorella
(`commanderwave-frontend`): scarica le whitelist una volta, le mette in cache in
localStorage, e da quel momento filtra tutto lato client. Cercando l'equivalente
"già pronto" per questo progetto (invece di scrivere a mano un composable con
`getCached`/`setCached` + stato di modulo), abbiamo trovato che **Pinia Colada**
(già usato qui, ADR-015 — vedi `useCommanderCards.ts`) ha un plugin ufficiale
fatto apposta per questo: **`@pinia/colada-plugin-cache-persister`**
(verificato su npm: compatibile con `@pinia/colada@^1.4.2` già installato).
Questo ci evita di reinventare dedup delle chiamate concorrenti, stato di
loading/errore, e la persistenza in localStorage — Colada + il plugin lo fanno
già, in modo idiomatico e coerente con il resto del progetto.

In più, lato Postgres: sostituiamo il loop di paginazione client-side con una
funzione RPC che aggrega tutto in un'unica riga JSON (`json_agg`), bypassando
il limite di 1000 righe di PostgREST (che si applica al conteggio delle righe
HTTP, non al contenuto di un singolo JSON) — un'unica richiesta invece di 3.

## 1. Nuova funzione RPC Postgres — migrazione

Nuovo file `supabase/migrations/20260721000000_add_commander_catalog_rpc.sql`:

```sql
-- Migration: RPC to fetch the full commander catalog in one request
-- Created: 2026-07-21
--
-- The client needs a lightweight snapshot of every commander (for whitelist
-- classification + autocomplete search) cached via Pinia Colada. A plain
-- `select *` on mtg_commanders (2986 rows) gets silently truncated to 1000
-- rows by PostgREST's default row cap — this happened in production and
-- broke Background-commander detection for ~2000 cards. json_agg collapses
-- the whole result into a single JSON value, so PostgREST sees exactly one
-- row in the response and the per-row cap never applies.

CREATE OR REPLACE FUNCTION get_commander_catalog()
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT card_name, partner_type, keywords, partner_with_scryfall_id,
           mana_cost, edhrec_rank, image_url
    FROM mtg_commanders
  ) t
$$;

COMMENT ON FUNCTION get_commander_catalog() IS
  'Returns the full mtg_commanders catalog (whitelist + search fields) as one JSON array, avoiding PostgREST''s 1000-row cap. Cached client-side via Pinia Colada + cache-persister (commander-catalog query key).';

GRANT EXECUTE ON FUNCTION get_commander_catalog() TO anon;
```

`mtg_commanders` already has an `anon_read_only` SELECT policy (verified via
`supabase db query --linked`) and the function is `SECURITY INVOKER` (default),
so it runs as `anon` and is already covered by that policy — no RLS changes
needed, just the `GRANT EXECUTE`.

## 2. Installare e configurare il cache-persister di Pinia Colada

```bash
pnpm add @pinia/colada-plugin-cache-persister
```

Nuovo file `colada.options.ts` alla radice del progetto (letto automaticamente
dal modulo `@pinia/colada-nuxt`):

```ts
// colada.options.ts
import { PiniaColadaCachePersister } from '@pinia/colada-plugin-cache-persister'
import type { PiniaColadaOptions } from '@pinia/colada'

export default {
  plugins: [
    PiniaColadaCachePersister({
      key: 'league-colada-cache',
      // Nessun `filter`: persiste TUTTE le query Colada, non solo il
      // catalogo comandanti. App usata dal vivo ai tornei, spesso su wifi
      // di sede inaffidabile — per standings/pairings (staleTime di
      // default, 5s) la persistenza non evita un refetch (che parte
      // comunque quasi subito), ma mostra l'ultimo dato noto all'istante
      // dopo un reload invece di uno stato vuoto/di errore, e lo lascia
      // visibile se il refetch fallisce per mancanza di rete. Il catalogo
      // comandanti resta il caso con staleTime/gcTime mensile.
    }),
  ],
} satisfies PiniaColadaOptions
```

## 3. Nuovo composable — `app/composables/commanders/useCommanderCatalogQuery.ts`

Stessa forma già usata da `useCommanderCards.ts` (query key + funzione fetch +
`useQuery` con `staleTime`/`gcTime`) — non serve stato di modulo a mano, non serve
`getCached`/`setCached` diretto, non serve un flag `inFlight` per il dedup:
Colada condivide automaticamente UNA sola voce di cache per chi chiama
`useCommanderCatalogQuery()` con la stessa chiave, ovunque nell'app.

```ts
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
// una correzione manuale (es. i 31 "Choose a Background" corretti oggi).
// Sia staleTime (quanto resta "fresco" prima di un refetch in background)
// SIA gcTime (quanto resta in cache anche da inattivo prima di essere
// scartato) vanno impostati alla stessa durata — il plugin cache-persister
// persiste solo ciò che è ancora nella cache di Colada: con il solo
// staleTime aumentato, il gcTime di default (breve) avrebbe comunque
// scartato la voce e vanificato la persistenza mensile.
const CATALOG_CACHE_TIME = 30 * 24 * 60 * 60 * 1000

async function fetchCommanderCatalog(
  supabase: ReturnType<typeof useSupabaseClient<Database>>
): Promise<CommanderCatalogRow[]> {
  const { data, error } = await supabase.rpc('get_commander_catalog')
  if (error) throw error

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    name: row.card_name as string,
    partnerType: row.partner_type as string | null,
    keywords: (row.keywords as string[] | null) ?? [],
    partnerWithScryfallId: row.partner_with_scryfall_id as string | null,
    manaCost: row.mana_cost as string | null,
    edhrecRank: row.edhrec_rank as number | null,
    imageUrl: row.image_url as string | null,
  }))
}

/** L'intero catalogo comandanti — cache condivisa via Colada, persistita in
 * localStorage dal plugin cache-persister (vedi colada.options.ts). */
export function useCommanderCatalogQuery() {
  const supabase = useSupabaseClient()

  return useQuery({
    key: () => COMMANDER_CATALOG_KEY,
    query: () => fetchCommanderCatalog(supabase),
    staleTime: CATALOG_CACHE_TIME,
    gcTime: CATALOG_CACHE_TIME,
  })
}
```

## 4. `useCommanderWhitelists.ts` — consuma la query condivisa

Firma esterna invariata (`whitelists`, `isLoading`, `loadAllLists`,
`getPartnerType`, `getAllowedPartners`) — nessuna modifica al call site in
`CommanderModal.vue`. Internamente:
1. `const { data: catalog, isLoading, refetch } = useCommanderCatalogQuery()`
2. `loadAllLists()` diventa un `watch`/computed che ricostruisce i 7 array
   derivati + le due Map da `catalog.value` ogni volta che cambia (stessa
   logica di branching già presente, solo senza fetch proprio) — oppure resta
   una funzione esplicita che legge `catalog.value` se si vuole mantenere la
   stessa forma imperativa esistente
3. Espone `refetch` (rimappato, per il pulsante manuale al punto 6)

Elimina il loop `.range()` e la chiamata Supabase diretta — quella logica non
serve più: la query RPC prende tutto in un colpo solo (punto 1), e Colada
gestisce cache/dedup/persistenza (punti 2-3).

## 5. `useCommanderSearch.ts` — filtro lato client + dedup `handleSelect`

`fetchSuggestions(q)`:
- Legge `useCommanderCatalogQuery()`'s `data.value` (già caricato/cache-hit
  quasi sempre, dato che `useCommanderWhitelists` lo richiede già all'apertura
  della modale con la stessa chiave — Colada condivide la stessa voce)
- Filtra per `name` (substring case-insensitive) e, se presente,
  appartenenza a un `Set` costruito da `options.whitelist`
- Ordina per `edhrecRank` (ascendente, null in fondo), taglia a 50
- `suggestionMeta` costruito dal `manaCost` già presente in ogni riga (niente
  query aggiuntiva)
- `reorderByPlayerUsage()` resta invariato (query reale su `round_results`,
  dato per-giocatore, non catalogo)
- **Mantiene il debounce di 150ms** — il costo eliminato era la latenza di
  rete, non il filtro in sé (istantaneo su ~3000 righe), ma il debounce evita
  di rilanciare `reorderByPlayerUsage` ad ogni tasto

`handleSelect(name)`: sostituire il fetch inline `.select('*').eq(name).single()`
+ `mapToCommanderCard` con `fetchCommanderByName` già esistente in
`useCommanderCards.ts` (va solo esportata, oggi è privata del modulo) —
elimina la duplicazione di logica.

## 6. Pulsante di refresh manuale

In `CommanderModal.vue`, vicino all'apertura/label superiore della modale.
`UButton` piccolo, `icon="ICONS.refresh"`, con
`useButtonLogging('Refresh Commander Catalog')` per coerenza con la
convenzione del CLAUDE.md radice. Disabilitato/spinner mentre
`catalog.isLoading` (ri-esportato da `useCommanderWhitelists`, punto 4).

Click → chiama `refetch()` della query Colada — questo rifà la RPC E il
plugin cache-persister ri-scrive automaticamente il risultato fresco in
localStorage: nessuna logica manuale di "cancella questa chiave" da scrivere.

Nuove chiavi i18n in `i18n/locales/it.json`, dentro il namespace `commander`
esistente:
```json
"refreshCatalog": "Aggiorna elenco carte",
"refreshingCatalog": "Aggiornamento in corso..."
```

## 7. Cache leggera per-carta — decisione: non serve

Il progetto React aveva bisogno di una cache separata per-carta perché
cachava solo liste di nomi, non l'intero catalogo. Qui, aggiungendo
`mana_cost`/`image_url` all'unica RPC (punto 1), ogni riga del catalogo
cachato **è già** il record leggero `{ name, manaCost, imageUrl }`
richiesto — gratis. `CardPreview.vue` resta invariato: richiede il
`CommanderCard` completo (largeImageUrl, oracleText, colorIdentity per
`resolveCardColors`) che la riga leggera non può soddisfare comunque, e
l'unica query rimasta (`fetchCommanderByName` su selezione) è già una singola
lookup indicizzata, non il collo di bottiglia che stiamo risolvendo.

## 8. Nessuna modifica necessaria altrove

- `CommanderModal.vue`'s `onMounted(() => loadAllLists())` non cambia — diventa
  trasparentemente no-op di rete dopo il primo caricamento (Colada condivide
  la cache in memoria nella sessione, il plugin la ripristina da localStorage
  tra un reload e l'altro entro lo `staleTime` di un mese).
- `useCommanderCards.ts`: esportare `fetchCommanderByName` (oggi privata).
- `docs/architecture/async-data-keys.md`: `['commander-catalog']` segue già
  il formato di chiave Colada documentato lì — nessuna nota aggiuntiva
  necessaria (a differenza dell'approccio con localStorage manuale, qui non
  c'è un secondo namespace di chiavi da spiegare).
- `app/utils/localStorage.ts` (`getCached`/`setCached`) **non va rimosso**:
  resta l'unico strumento giusto per `app/composables/event/useSessionStorePersistence.ts`
  (l'assicurazione anti-crash che specchia lo stato di 4 store di sessione
  — rankings/kills/commanders/votes — su localStorage ad ogni mutazione,
  poi lo ripristina al mount se il round combacia). Non è un problema di
  cache di query (niente fetch asincrono da un server, nessun `staleTime`
  sensato): è un mirror bidirezionale di stato locale mutabile, un caso
  d'uso strutturalmente diverso da quello che Colada risolve. Dopo questo
  cambiamento `getCached`/`setCached` avrà un solo chiamante invece di due,
  ma resta l'utility corretta per quel chiamante.

## Verifica end-to-end

1. `pnpm exec supabase db query --linked` per confermare che la funzione RPC
   esiste e restituisce tutte le 2986 righe in un'unica risposta dopo aver
   applicato la migrazione.
2. Avviare l'app, aprire la modale comandante, cercare "Candlekeep Sage" come
   secondo comandante di un commander con `partner_type = background_commander`
   — deve comparire (verifica di regressione sul bug di paginazione).
3. DevTools → Network: alla prima apertura della modale, una sola richiesta
   verso l'RPC (non più 3 verso `mtg_commanders`); `localStorage` deve avere
   la chiave `league-colada-cache`.
4. Chiudere/riaprire la modale nella stessa pagina — zero nuove richieste
   (hit di cache Colada in memoria).
5. Ricaricare la pagina, riaprire la modale — zero nuove richieste (il
   plugin ripristina la cache da localStorage, `staleTime` non scaduto).
6. Digitare nella ricerca comandante — zero richieste verso `mtg_commanders`
   ad ogni tasto (solo eventuali richieste a `round_results` per il riordino
   per giocatore).
7. Cliccare il pulsante di refresh manuale — una nuova richiesta RPC, la
   cache persistita si aggiorna, la ricerca continua a funzionare subito dopo.
8. `pnpm lint` e `pnpm typecheck` puliti su tutti i file toccati.

### File coinvolti
- `supabase/migrations/20260721000000_add_commander_catalog_rpc.sql` (nuovo)
- `colada.options.ts` (nuovo, radice progetto)
- `app/composables/commanders/useCommanderCatalogQuery.ts` (nuovo)
- `app/composables/commanders/useCommanderWhitelists.ts`
- `app/composables/commanders/useCommanderSearch.ts`
- `app/composables/commanders/useCommanderCards.ts` (esporta `fetchCommanderByName`)
- `app/components/commander/CommanderModal.vue` (pulsante di refresh)
- `i18n/locales/it.json`
- `package.json` (nuova dipendenza `@pinia/colada-plugin-cache-persister`)
