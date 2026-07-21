// colada.options.ts
import { PiniaColadaCachePersister } from '@pinia/colada-plugin-cache-persister'
import type { PiniaColadaOptions } from '@pinia/colada'

export default {
  plugins: [
    PiniaColadaCachePersister({
      key: 'league-colada-cache',
      // Nessun `filter`: persiste TUTTE le query Colada, non solo il
      // catalogo comandanti. Questa è un'app usata dal vivo ai tornei, spesso
      // su wifi di sede inaffidabile — per standings/pairings (staleTime di
      // default, 5s) la persistenza non serve a evitare un refetch (che
      // parte comunque quasi subito), ma a mostrare l'ultimo dato noto
      // all'istante dopo un reload invece di uno stato vuoto/di errore, e a
      // lasciarlo visibile se il refetch fallisce per mancanza di rete. Il
      // catalogo comandanti resta il caso con staleTime/gcTime mensile — le
      // altre query si aggiornano comunque non appena la rete torna.
    }),
  ],
} satisfies PiniaColadaOptions
