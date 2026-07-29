# PROGRESS — MTG League Manager

Documento vivo per tracciare avanzamento, architettura e decisioni. Aggiornare quando cambiano scope, stack o convenzioni rilevanti.

**Ultimo aggiornamento:** 2026-07-22

---

## Obiettivo del progetto

Applicazione web per gestire **leghe Magic: The Gathering**: ruleset, leghe, eventi/tornei, iscrizioni (waiting list), abbinamenti (pairings), punteggi, classifiche e flussi di gioco in sala (modali punteggi, kill, commander, voti deck/play).

Priorità dichiarate (`docs/AGENTS.md`): **stabilità**, **velocità**, **ottima UX**.

---

## Stack tecnologico

| Layer | Tecnologia |
|-------|------------|
| Framework | Nuxt 4 (`app/` come source root) |
| UI | Nuxt UI 4, Tailwind CSS 4 |
| Stato | Pinia (Setup Store) |
| Backend / DB | Supabase (`@nuxtjs/supabase`) |
| Utilità | VueUse, Vue Flow (kill flow), vue-draggable-plus |
| Tooling | pnpm 10, ESLint, vue-tsc, Vitest |
| Auth app | Password globale (`middleware/password.global.ts`) |

---

## Architettura (panoramica)

```
app/
├── pages/              # Route file-based
├── components/         # UI per feature (commander/, deck/, event/, league/, player/, ruleset/, Ui/)
├── composables/        # Logica riutilizzabile
│   ├── supabase/       # Fetch SSR + delega agli store persistenti
│   ├── event/          # Pagina evento, URL sync, preset pairing, lifecycle
│   ├── event-pairing/  # Optimizer abbinamenti + preferenze (fonte canonica, con test)
│   └── commanders/, players/, tables/, theme/, ui/, auth/
├── stores/             # Pinia: Supabase + stato sessione evento
├── middleware/         # Protezione password
├── plugins/            # Route logger
└── assets/css/         # Stili globali

shared/utils/types/     # Tipi DB (generati) e dominio condivisi
supabase/migrations/    # Migrazioni SQL (timestamp prefix, idempotenti)
docs/                   # Documentazione feature e convenzioni (indice: docs/README.md)
CLAUDE.md               # Guida per Claude Code (comandi, architettura, convenzioni)
```

**Nota:** la cartella `app/composables/events/` (plurale) è stata rimossa il 2026-07-12 — era uno shim di re-export lasciato da un rename verso `event-pairing/`. Il progetto non è ancora pubblicato, quindi non manteniamo compatibilità all'indietro: rinominare/cancellare pulito e aggiornare i call site, non lasciare shim.

### Pattern dati

1. **Store Pinia** = fonte di verità per entità Supabase e stato UI di sessione (rankings, kills, votes, commanders).
2. **Composables `use*`** = orchestrazione pagina, `useAsyncData`, helper puri.
3. **Pagine** = composizione componenti; la pagina evento è la più complessa (`useEventPage` + `useEventUrl`).

Dettaglio completo: [`docs/architecture/stores.md`](docs/architecture/stores.md).

---

## Route principali

| Route | Scopo |
|-------|--------|
| `/` | Home |
| `/login` | Auth password + redirect query |
| `/leagues` | CRUD leghe |
| `/rulesets` | Gestione ruleset |
| `/league/[id]` | Eventi di una lega |
| `/league/[leagueId]/event/[eventId]` | Hub evento (registrazione → playing → ended) |
| `/players`, `/player/[slug]` | Roster giocatori, profilo |
| `/decks`, `/deck/[deckSlug]`, `/player/[slug]/deck/[deckSlug]` | Mazzi commander |

**Nota sul parametro route lega (aggiornata 2026-07-20):** `app/pages/league/[id].vue` usa `route.params.id`, mentre la route annidata evento usa `[leagueId]`. Non è un'inconsistenza da risolvere: è strutturalmente necessario che i due segmenti abbiano nomi diversi (`league/[leagueId]/event/[eventId]` non potrebbe avere due parametri chiamati entrambi `id` sullo stesso percorso), e la pagina lega da sola non ha ambiguità da disambiguare. Discusso e chiuso più volte — non riaprire come TODO.

---

## Store Pinia (10)

| Store | Tipo stato | Ruolo |
|-------|------------|--------|
| `useLeagueStore` | Supabase | Leghe |
| `useRulesetStore` | Supabase | Ruleset punteggio |
| `usePlayerStore` | Supabase | Giocatori + waiting list |
| `usePlayerStatsStore` | Supabase | Statistiche giocatore denormalizzate (`player_stats`) |
| `useEventStore` | Supabase | Eventi, standings, pairings, round, round_results |
| `useCommanderDeckStore` | Supabase | Mazzi commander registrati |
| `useRankingsStore` | Sessione + DB | Ordine classifica salvato su `round_results.position` via `savePairingRankings` |
| `useKillsStore` | Sessione + DB | Kill nel round, persistiti su `round_results.number_of_kills` via `savePairingKills` |
| `useVotesStore` | Sessione + DB | Voti deck/play, persistiti su `round_results.brew_vote/play_vote_1` via `saveVote` |
| `useCommandersStore` | Sessione + DB | Commander per giocatore, persistiti su `round_results.commander_1` via `saveCommander` |

Tutti gli store usano **Setup API** (`defineStore('id', () => { … })`).
Gli store di sessione hanno **persistenza ottimistica**: update immediato UI + salvataggio asincrono su `round_results` via `useEventStore` + toast di esito.

---

## Decisioni architetturali

### ADR-001 — Nuxt 4 con `app/` come root

- **Decisione:** directory `app/` per pages, components, composables (non root legacy `pages/`).
- **Motivo:** allineamento a Nuxt 4 e convenzioni documentate in `AGENTS.md`.

### ADR-002 — Pinia per Supabase + stato sessione evento

- **Decisione:** CRUD e cache lato client negli store; composables sottili che chiamano `useAsyncData` dove serve SSR.
- **Motivo:** evitare refetch ridondanti (`initialized`), stato condiviso tra modali sulla pagina evento.

### ADR-003 — Sync URL ↔ modali / fase evento

- **Decisione:** query `phase`, `round`, `scoreModal` sincronizzati con UI (`useEventUrl`, `router.replace`).
- **Motivo:** deep link, refresh, condivisione link a modale punteggi.
- **Parametri:** `phase`, `round`, `scoreModal`, `killModal`, `votesModal`, `commanderModal`
- **Doc:** [`docs/architecture/modal-url-sync.md`](docs/architecture/modal-url-sync.md)

### ADR-004 — Pairing optimizer lato client

- **Decisione:** algoritmo in `app/composables/event-pairing/pairingOptimizer.ts` con pesi/preferenze salvate per evento.
- **Motivo:** preview tavoli interattiva (DnD + ottimizzazione) senza round-trip server per ogni tentativo.
- **Test:** `pairingOptimizer.test.ts` (6 test Vitest).
- **Nota (2026-07-12):** documentato esplicitamente nel file l'invariante `sum(perPlayer[p].total) === tableScore.total` — alcuni pesi (novelty, rematch, rotateTable3) sono applicati due volte intenzionalmente (una per giocatore al punto di attribuzione, una per il totale tavolo), a differenza di `strengthBalance` che è pesato una sola volta perché è una quantità di tavolo, non attribuibile a un singolo giocatore. Non "correggere" aggiungendo pesi ai contatori raw.

### ADR-005 — Convenzioni Vue 3.4+ per le props

- **Decisione:** `defineProps<{ … }>()` inline; default con **destructuring reattivo**, non `withDefaults`.
- **Motivo:** sintassi raccomandata Vue 3.4+, default co-locati, reattività preservata.
- **Doc:** [`docs/AGENTS.md`](docs/AGENTS.md) (sezione Vue Components)

### ADR-007 — Persistenza ottimistica dei dati di sessione su `round_results`

- **Decisione:** `rankingsStore`, `killsStore`, `votesStore`, `commandersStore` salvano in memoria (Pinia) e su DB (`round_results`) in modo asincrono.
- **Pattern:** update immediato UI (ottimistico) → `toast.add({ title: '…', color: 'success' })` → chiamata asincrona a `eventStore.save*()` → toast di errore in caso di fallimento.
- **Motivo:** UX reattiva senza attendere la risposta del DB, dati non persi su refresh, `nextRound` legge da `round_results` per calcoli punteggi corretti.
- **Funzioni store:** `saveVote`, `saveCommander`, `savePairingRankings`, `savePairingKills` — tutte con pattern update-or-insert (check esistenza riga → update o insert).
- **Doc:** flusso documentato in `docs/architecture/stores.md`.

### ADR-006 — Auth semplice a password

- **Decisione:** `sitePassword` in `runtimeConfig` + middleware globale; Supabase senza redirect auth utente (`redirect: false`).
- **Motivo:** app interna / circolo; non login multi-utente Supabase al momento.
- **Stato:** ✅ già letta da `process.env.NUXT_SITE_PASSWORD` in `nuxt.config.ts` — non più hardcoded.

### ADR-008 — Colonna `event_round_duration`

- **Decisione:** aggiunta colonna `events.event_round_duration` (INTEGER, nullable) per la durata round configurabile per evento.
- **Stato (2026-07-12):** migrazione scritta in `supabase/migrations/20260712000000_add_event_round_duration.sql` e tipi generati aggiornati manualmente in `shared/utils/types/database.ts` — **non ancora applicata al DB reale** (nessuna credenziale Supabase CLI disponibile in sessione agente). Da applicare (`supabase db push` o dashboard) e poi rigenerare i tipi per davvero via `npx supabase gen types ...`.
- **Motivo:** il campo era già nel form evento (`EventFormModal.vue`) ma veniva scartato silenziosamente prima di questa modifica — mai persistito, mai letto.

### ADR-009 — Policy 0 warning / 0 errori su lint e typecheck

- **Decisione:** `pnpm lint` e `pnpm typecheck` devono restare a 0 warning / 0 errori; enforced in CI (`.github/workflows/ci.yml`).
- **Motivo:** prevenire drift silenzioso (es. `any` che nasconde bug reali — vedi la colonna `event_round_duration` sopra, mascherata da `as any` per mesi).
- **Doc:** sezione "After File Modifications" in `docs/AGENTS.md`, e `CLAUDE.md`.

### ADR-010 — Migrazione completa delle stringhe UI a `@nuxtjs/i18n`

- **Decisione:** tutte le stringhe italiane hardcoded nell'app (componenti, pagine, composables, store Pinia) sono state centralizzate in `i18n/locales/it.json`, caricato lazy da `@nuxtjs/i18n@10.4.1`. `i18n/i18n.config.ts` contiene solo opzioni non-messaggio (`{ legacy: false, locale: 'it' }`).
- **Motivo:** prima della migrazione ogni stringa era duplicata inline in decine di call site (stesso problema già risolto per le icone con `app/utils/icons.ts`); centralizzarle rende più facile trovare/riusare testo esistente e prepara il terreno nel caso servisse mai una seconda lingua (non l'obiettivo primario, ma un effetto collaterale utile).
- **Pattern e vincoli scoperti durante la migrazione** (dettagliati in `CLAUDE.md`, sezione "Conventions worth knowing"):
  - `defineProps()` con default che referenziano `t()` non compilano (hoisting del compiler Vue) — risolto con `computed()` separato (vedi `CancelButton.vue`, `ConfirmModal.vue`, `DatePicker.vue`).
  - `useI18n()` funziona dentro un Pinia store (verificato empiricamente) solo se lo store viene istanziato per la prima volta da dentro il `setup()` sincrono di un componente — pattern universale in questo progetto.
  - Funzioni raggiungibili da un'azione di store o da una callback async (`useAsyncData`) non possono chiamare `useI18n()` direttamente — il `t` va catturato a monte e passato come parametro (vedi `useTableCalculator.ts`, `usePlayerMatchHistory.ts`).
  - I valori enum persistiti su DB restano stringhe letterali, non copy UI — tradotti solo a display time via lookup su label-key. **Aggiornamento 2026-07-13:** `leagues.status` è stato rinominato da testo italiano leggibile (`'Programmata'`/`'Attiva'`/`'Terminata'`) a codici inglesi minuscoli (`'scheduled'`/`'active'`/`'ended'`), allineati alle chiavi i18n già esistenti (`league.status.scheduled` ecc.). Codice aggiornato in `LeagueTable.vue` e `useLeagues.ts`; migrazione dati DB da applicare manualmente (utente).
- **Test infra:** `test/helpers/mocks.ts` esporta `createI18nTestPlugin(messages)` per montare componenti che usano `useI18n()` in `test/nuxt/**` (plain `@vue/test-utils` `mount()` non applica il plugin reale di Nuxt).
- **Stato:** ✅ completo — verificato con `pnpm lint`/`pnpm typecheck`/`pnpm test`/`pnpm fallow:dead-code` a zero problemi dopo ogni dominio migrato (league, ruleset, player, deck/commander, event — pagina/control-panel/waiting-list/modali/pairing-kill-table/standings —, store, login/home/misc).

### ADR-011 — Eliminazione duplicazione codice + tuning config `fallow`

- **Decisione:** sessione dedicata a ridurre la duplicazione di codice segnalata da `fallow:dupes`, riorganizzare `app/components/ui/` in sottocartelle per famiglia, e configurare `.fallowrc.json` per un segnale duplicazione/complessità accurato invece di rumore.
- **Duplicazione — da 128 gruppi (17.6%) a 0.** Estrazioni reali (non falsi positivi):
  - `app/components/ui/modal/FormModal.vue` + `app/composables/ui/useFormModalMeta.ts` — shell modale create/edit condivisa da `LeagueFormModal`, `RulesetFormModal`, `CreatePlayerModal`, `EventFormModal`, `DeckCreateModal`, `DeckEditModal`.
  - `app/components/ui/modal/{CancelButton,ConfirmButton,ModalFooterActions}.vue` — famiglia bottoni footer modale, separata deliberatamente da `RowActionButton`/`RowActionButtons` (famiglia bottoni azione riga tabella, config-driven via `ACTION_MAP`). Vedi `app/components/ui/CLAUDE.md` per la distinzione.
  - `app/components/ui/display/{StatTile,ImageWithFallback,BaseTable}.vue`, `app/components/ui/layout/{ListPageShell,PageHeaderRow}.vue` — pattern UI ripetuti (tile statistiche, immagine con fallback caricamento/mancante, header pagina lista).
  - `app/composables/ui/useBreadcrumb.ts` — prepend home-crumb condiviso, sostituisce un `usePlayerBreadcrumb` troppo specifico.
  - `app/composables/deck/{useDeckDisplay,useLenderSelection}.ts`, `app/composables/league/useLeagueUpdate.ts`, `app/composables/players/usePlayerBreadcrumb.ts` (poi sostituito da `useBreadcrumb`) — logica dominio condivisa tra pagine/modali dello stesso feature.
  - `app/components/ruleset/RulesetFieldGrid.vue`, `app/components/event/pairing/table/score/TableScoreTeamRow.vue` — duplicazione interna allo stesso file (due sezioni quasi identiche) risolta con un piccolo componente locale invece di un `v-model` su proprietà annidate (rischio noto di mancato unwrap dei ref in Vue).
  - `forEachPair` in `pairingOptimizer.ts` — helper privato per il doppio ciclo "ogni coppia di seat in un tavolo", riusato in 3 punti; **la matematica di scoring non è stata toccata** (invariante ADR-004 preservato, verificato contro i test esistenti).
- **Falsi positivi identificati e sospesi formalmente** (`// fallow-ignore-file code-duplication` o `.fallowrc.json`'s `duplicates.ignore`), non silenziosamente ignorati:
  - Pattern CRUD store (`leagues.ts`, `rulesets.ts`, `players.ts`, `commander-decks.ts`, `events.ts`) — intenzionale, documentato in `app/stores/CLAUDE.md` ("copiare `leagues.ts` come template").
  - Boilerplate di invocazione `FormModal`/`LeagueFormModal`/`ConfirmModal` nei call site (title/description/icon/submitLabel + `@cancel`) — residuo minimo e atteso dell'uso coerente di un componente già condiviso.
  - Markup `<table>`/toolbar generico coincidente tra feature non correlate (`EventRanking` vs `PlayerMatchHistoryTable`; `TablePreviewToolbar` vs `WaitingListTable`).
  - `EventTable.vue`/`LeagueTable.vue` — colonne id/name boilerplate; lasciato con commento di sospensione invece di estrarre in `useTableUtils.ts`, per mantenere ogni file tabella leggibile in un unico posto (decisione esplicita).
- **Modalità di duplicate-detection:** `.fallowrc.json`'s `duplicates.mode` provato a `semantic` (troppo rumoroso, penalizza `fallow health` di -10 anche su pattern intenzionali), poi `strict` (troppo permissivo, 0 duplicati anche su vera duplicazione), assestato su **`weak`** (normalizza i valori letterali ma non i nomi identificatore — il compromesso giusto per questo progetto).
- **`health.thresholdOverrides`** aggiunto in `.fallowrc.json` per 10 file/funzioni grandi ma intenzionalmente coese (`useEventStore` 1039 righe, `useEventPage`, `useTableDnd`, i template grandi di pairing/timer) — ceiling esplicito invece di soppressione binaria, così restano visibili se crescono oltre il nuovo limite. Punteggio `fallow health` invariato (79 B: la penalità "unit size" è basata sulla distribuzione percentuale di tutto il progetto, non sul conteggio dei singoli file) — non è un problema, il punteggio grezzo non è l'obiettivo da inseguire.
- **Gotcha scoperto:** i glob pattern in `.fallowrc.json` non possono usare `[...]` letterali per le cartelle route dinamiche di Nuxt (`[leagueId]`, `[id]`) — il motore glob li legge come character class, e l'escape con backslash non funziona (probabile conflitto con `\` come separatore path su Windows). Soluzione: sostituire ogni `[`/`]` con un wildcard `?` (es. `league/?leagueId?/event/?eventId?.vue`). Documentato in `CLAUDE.md`.
- **`leagues.status`** rinominato da italiano leggibile a codici inglesi minuscoli in questa stessa sessione (vedi nota ADR-010 sopra) — cambio non correlato alla duplicazione ma emerso durante l'audit dello stesso file (`LeagueTable.vue`).

### ADR-012 — Persistenza localStorage degli store di sessione + mutazione in-place di Map/Set

- **Contesto:** gli store di sessione (`rankings`, `kills`, `votes`, `commanders`) vivevano solo in memoria — un refresh/kill del tab a metà round perdeva i dati inseriti ma non ancora confermati su DB. Inoltre tre store su quattro ricreavano il container dopo ogni mutazione (`x.value = new Map(x.value)`) per "forzare la reattività", mentre `commanders.ts` mutava in place — entrambi funzionano (Vue 3 strumenta i metodi di Map/Set), quindi le copie erano lavoro O(n) ridondante e inconsistente.
- **Decisione (persistenza):** nuovo `useSessionStorePersistence` (`app/composables/event/`) — snapshot dei quattro store in localStorage via `getCached`/`setCached` (TTL 12h), **una sola chiave per evento** (`event-session-{id}`) con il numero di round *dentro* lo snapshot: qualsiasi cambio di round (avanti o indietro) sovrascrive lo snapshot con lo stato vuoto del nuovo round, quindi i dati stantii si auto-invalidano — scartata la variante chiave-per-round (lasciava chiavi orfane e su turn-back + refresh reidratava dati di un round già cancellato dal DB). Idratazione in `onMounted` (evita hydration mismatch SSR); il watcher di persistenza parte solo dopo l'idratazione (lo stato iniziale vuoto non può sovrascrivere uno snapshot buono).
- **Decisione (seam futuro):** ogni store di sessione espone `hydrate(snapshot)` come **unico punto d'ingresso per dati esterni**. Quando arriverà il self-entry multi-giocatore (`docs/BACKLOG.md` #2), l'inserimento in corso passerà a righe DB + Supabase Realtime *a livello di store*, alimentando lo stesso `hydrate()` — i componenti non cambiano (leggono già solo gli store). Deliberatamente NON costruita ora alcuna infrastruttura realtime/adapter (YAGNI: verrebbe sostituita, non estesa).
- **Decisione (stile di mutazione):** Map/Set si mutano **in place** (`map.set(...)`, `set.add(...)`, `clear()` in `reset()`); rimosse tutte le copie difensive da `rankings`/`votes`/`kills`. Solo `hydrate()` sostituisce il container. Conseguenza per i consumer: mai `watch(store.someMap)` per riferimento — sempre la forma getter `watch(() => store.someMap, fn, { deep: true })`. Fix contestuale di un bug latente reale: `KillFlowCanvas.vue` osservava `killsStore.kills` per riferimento, e dopo il primo `removeKill` (che sostituisce l'array) il watcher restava agganciato all'array morto.
- Test: round-trip completo persistenza/idratazione in `test/unit/composables/event/useSessionStorePersistence.test.ts` (store fake reattivi tipizzati strutturalmente — il vero `kills.ts` chiama `useI18n()` nel setup, non disponibile nei plain unit test).

### ADR-013 — Backend-For-Frontend (BFF) per le scritture DB

- **Contesto:** l'app gira come ruolo `anon` (gate a password di sito solo lato Nuxt middleware, nessuna Supabase Auth) — ogni tabella applicativa è scrivibile via Data API da chiunque estragga la anon key dal bundle. Il bug "Classifica a 0" del 2026-07-14 (update su `standings` filtrati silenziosamente da RLS, errori mai controllati) ha mostrato anche il problema di *affidabilità*: le transizioni multi-step (avanzamento round) sono orchestrate dal client e possono morire a metà. Deploy serverless (funzioni Nitro — precedente: `server/api/auth/login.post.ts`).
- **Decisione: pattern Backend-For-Frontend.** Le scritture passano da endpoint Nitro (`server/api/*`) con la service-role key (env var server-only); le policy di scrittura `anon` vengono negate tabella per tabella man mano che la migrazione procede. Le letture restano client → Supabase dirette (policy SELECT), Realtime futuro incluso.
- **Endpoint intent-based, mai table-based:** nominano azioni di dominio (`advance-round`, `turn-back-round`, `register-player`, `confirm-table-scores`), non tabelle — è questo che li rende stabili rispetto ai cambi di schema DB (il contratto è l'azione; lo schema è un dettaglio interno della route). Vietati i proxy CRUD generici (`PATCH /api/standings/:id`). Ogni endpoint è coarse-grained: una chiamata = una transizione atomica completa (non N update proxati — anche per i cold start serverless).
- **Gli store diventano thin client dell'API, forma pubblica invariata:** i componenti continuano a chiamare `eventStore.nextRound()`; dentro, l'orchestrazione (`calculateRoundScores`, `updateStandingsAndRanks`, …) si sposta nella route (per lo più copy-paste: sono già funzioni pure module-level, il BACKLOG #6 ne è di fatto la preparazione) e l'azione fa una `$fetch`. La route restituisce le righe appena scritte e lo store le assegna: lo stato locale rispecchia ciò che il server ha fatto davvero, non una stima ottimistica. Convenzione `{ success, error? }` invariata. Store di sessione e composable `useAsyncData` intoccati.
- **Evoluzione futura (decisa, non ipotetica): Supabase Auth con account per giocatore.** Quando i giocatori avranno identità reali (self-entry, BACKLOG #2), RLS con claim JWT diventa significativa e completa il quadro — *complementa* il BFF (per-row authorization sulle scritture self-service), non lo sostituisce: le transizioni multi-step vogliono comunque un arbitro server-side.
- **Alternative respinte:** Supabase Edge Functions (secondo runtime/pipeline per zero guadagno rispetto a Nitro già deployato); RPC-first (logica in SQL accoppia migrazioni di schema e di logica — tenuta solo come scappatoia di latenza per le scritture in-room); policy RLS scoped per riga senza auth (teatro di sicurezza: nessun claim da verificare).
- **Flip service-role completato (2026-07-19).** `NUXT_SUPABASE_SECRET_KEY`/`SUPABASE_SECRET_KEY` configurata (nome moderno, `SUPABASE_SERVICE_KEY` è deprecato — vedi il warning del modulo `@nuxtjs/supabase`); tutti i 19 endpoint `server/api/*` + `server/utils/roundResults.ts` sono passati da `serverSupabaseClient` (anon) a `serverSupabaseServiceRole`. Le policy di scrittura `anon` erano già state droppate lato utente prima del flip — due problemi emersi in sequenza, entrambi risolti: (1) le policy `anon_all_*` droppate erano anche l'unica lettura anon su `player_stats`/`deck_stats` (la migration tracciata concede `SELECT` solo ad `authenticated`, ruolo mai usato da quest'app), letture rotte app-wide finché `supabase/migrations/20260719020000_restore_anon_read_access.sql` non ha ripristinato `SELECT`-only per `anon` su tutte e 12 le tabelle; (2) `service_role` non aveva GRANT di alcun tipo su nessuna tabella (`information_schema.role_table_grants` non lo elencava affatto, a differenza di `anon`/`authenticated`/`postgres`) — errore "permission denied for table", un fallimento ACL *prima* della valutazione RLS, che nessuna policy avrebbe potuto risolvere. Risolto da `supabase/migrations/20260719021500_restore_service_role_grants.sql` (`GRANT ALL` + `ALTER DEFAULT PRIVILEGES` su tabelle/sequenze/funzioni per `service_role` — sicuro perché quel ruolo non è mai esposto al browser). Verificato end-to-end via UI reale (crea/modifica/elimina evento) e via chiamata diretta anon (ancora correttamente negata, 401/42501). **Il flip di BACKLOG #7 è completo**: nessuna scrittura client-side su nessuna tabella applicativa, in nessun percorso.
- Dettaglio operativo storico (vincoli serverless, piano a slice originale, gotcha SSR): rimosso da `docs/BACKLOG.md` a completamento (vedi sopra per lo stato finale).

### ADR-014 — Sessioni firmate (nuxt-auth-utils) al posto del cookie statico

- **Contesto:** il gate a password impostava un cookie `site-auth=authenticated` — valore fisso e noto, `httpOnly: false`. Chiunque poteva forgiarlo dai DevTools senza conoscere la password: il check (middleware di rotta + endpoint BFF) era decorativo, e sarebbe diventato l'unica barriera dopo il flip service-role di BACKLOG #7. Un tentativo precedente di passare a `httpOnly` era fallito perché `password.global.ts` leggeva il cookie via `useCookie` anche client-side, dove un cookie httpOnly è invisibile per definizione → redirect loop su `/login`.
- **Decisione:** modulo `nuxt-auth-utils` — cookie di sessione *sealed* (cifrato+firmato con `NUXT_SESSION_PASSWORD`, env server-only, 32+ caratteri) e `httpOnly`. Login: `setUserSession(event, { user: { admin: true } })` + `deleteCookie` del cookie legacy. Il client non legge mai il cookie: `useUserSession().loggedIn` (idratato SSR dal plugin del modulo) guida `password.global.ts`, e `getUserSession(event)` guida la guardia centralizzata `server/middleware/api-auth.ts` (che protegge tutto `/api/**` tranne `/api/auth/*` e gli interni Nuxt `/api/_*`).
- **Forma pubblica invariata:** `usePasswordAuth` espone ancora `isAuthenticated`/`login`/`logout`; il logout usa `clear()` del modulo (route interna `/api/_auth/session`, già esclusa dalla guardia via prefisso `/api/_`), quindi `server/api/auth/logout.post.ts` è stato eliminato. Payload di sessione tipizzato in `shared/types/auth-utils.d.ts` (augmentation di `#auth-utils`), pronto a crescere quando arriverà la Supabase Auth per giocatore (evoluzione futura di ADR-013).
- **Vincolo di deploy:** `NUXT_SESSION_PASSWORD` deve esistere in ogni ambiente (generata in `.env` locale; **da aggiungere su Vercel prima del prossimo deploy**, pena 500 sulle operazioni di sessione). `maxAge` 1 settimana in `runtimeConfig.session`, come il cookie precedente.

### ADR-015 — Pinia Colada per il layer dati, fuso con wave 4

- **Contesto:** la wave 4 di ADR-013 riscrive comunque il layer di scrittura di ogni store CRUD (da `supabase.from()` a `$fetch` verso il BFF). Una nota TODO del 2026-07-17 rimandava Pinia Colada a dopo il self-entry (BACKLOG #2) — ma fare wave 4 nel vecchio idioma e migrare a Colada dopo avrebbe significato riscrivere lo stesso layer due volte. Deciso (utente, 2026-07-17): adottare ora, fondendo le due migrazioni in slice per-entità scritte una volta sola nella forma finale.
- **Decisione:** per ogni entità CRUD una slice unica: endpoint BFF (ADR-013) + letture in `useQuery` (restano client → Supabase) + scritture in `useMutation` (`$fetch` + invalidazione della query key, refetch della verità server — niente aggiornamento ottimistico manuale). Lo store Supabase dell'entità si **elimina** (niente ibridi). Pattern dal template leagues: query per dominio (`useLeaguesQuery`, chiave `['leagues']`; il dettaglio deriva dalla lista via `useLeagueById`, nessun fetch per-id), mutation in `useLeagueMutations` con `onSettled: invalidate`, toast e stato UI nei composable di pagina (`useLeaguesPage`, `useLeagueUpdate`). Nei domini Colada la convenzione `{ success, error? }` è sostituita da `mutateAsync` + try/catch-con-toast — i catch silenziosi restano vietati.
- **Confini:** i quattro session store restano Pinia puro (stato UI effimero, non server state). `useEventStore` (lifecycle/round scoring) è fuori scope: è più macchina a stati che cache; si rivaluta a migrazione CRUD completata. Il mirror vitest include ora le auto-import Colada (`vitest.config.ts`, blocco KEEP IN SYNC).
- **Stato:** leagues migrata (template, 2026-07-17): 3 endpoint (`/api/leagues/create|:id/update|:id/delete`), store `leagues.ts` e `supabase/useLeagues.ts` eliminati. Rulesets migrata (2026-07-18): stessa forma, con due estensioni del pattern — la guardia di dominio "regolamento in uso da una lega" è passata dal client all'endpoint delete (409, prima era un check client-side aggirabile), e la pagina rulesets deriva l'uso-per-lega dalla query `['leagues']` già in cache invece del vecchio `useAsyncData` combinato `rulesets-with-leagues`.
- **Players, commander-decks, events-CRUD (2026-07-18): conversione thin-client, non ancora Colada.** Otto endpoint (`/api/players/create|:id/update`, `/api/decks/create|:id/update|:id/delete`, `/api/events/create|:id/update|:id/delete`) e le azioni di scrittura dei tre store convertite in `$fetch` — **l'obiettivo di sicurezza di wave 4 è completo: zero scritture Supabase client-side su tutte le tabelle entità.** La guardia "deck usato in un evento" è ora nell'endpoint delete (409); il vecchio check client aveva un bug latente (`head: true` + lettura di `data.length` → sempre falso) ed era di fatto inerte. Il lato-lettura di questi tre domini resta store-based deliberatamente: lo store players è la cache giocatori dell'intera pagina evento (11 consumer, waitroom incluso) e `useEventStore` è la macchina a stati del lifecycle — dissolverli ora significherebbe toccare il dominio evento senza rete E2E (BACKLOG #1). I corpi `$fetch` si riusano identici nelle future `useMutation`, quindi il costo del passaggio intermedio è ~40 righe di wrapper. **Prossima fase Colada:** commander-decks per prima (verificato: nessun consumer nella pagina evento), players+events insieme alla migrazione del dominio evento. **Decisione utente 2026-07-18: E2E rimandato, si procede con la migrazione Colada completa senza attendere BACKLOG #1.**
- **Events lato-lettura migrato a Colada (2026-07-18):** query `['events', leagueId]`, `['event-standings', eventId]`, `['pairings', eventId, round]` (chiave reattiva sul round: la visualizzazione dei round passati è ora un semplice cambio di `viewedRound`, spariti `viewedPairings` e il fetch manuale), `['pairing-history', eventId]` in `event/useEventQueries.ts`; `['league-standings', leagueId]` e `['event-standings-multi', ids]` in `league/useLeagueStandingsQuery.ts` (lo slot `standings.value` condiviso tra pagina lega e pagina evento è finalmente splittato su chiavi distinte). `useEventStore` è ora la sola macchina a stati del lifecycle (~300 righe da 739): `currentEvent` + azioni BFF + seam `save*` (ADR-007), senza più client Supabase né auto-fetch post-transizione — il **doppio-fetch** storico (azione che rifetcha + fan-out di `useEventPage`) è sostituito da un unico `refreshAfterLifecycle()` con refresh/invalidation delle query. Il blocco `useAsyncData` della pagina evento è dissolto (le query si SSR-prefetchano). Eliminati 6 wrapper `supabase/` (5 orfani/migrati + `usePairingsQuery.ts` trasferito) e uno shim di re-export residuo (`supabase/useCommanderDecks.ts`, vietato da convenzione). **La migrazione Colada dei domini CRUD+evento è completa**; restano solo le letture cards/stats (`useCommanderCards`, `usePlayerStats`, `useDeckStats`, `useCommanderStats`).
- **Players + waitroom migrati a Colada (2026-07-18):** query `['players']` (lista sanitizzata, `sanitizePlayer` trasferito in `usePlayersQuery.ts`) e `['waitroom', eventId]` (successore dello stato waitroom che viveva nello store players), mutation `usePlayerMutations`/`useWaitroomMutations` sui BFF esistenti. Store `players.ts` eliminato insieme ai wrapper `supabase/usePlayers.ts` e `supabase/useWaitroom.ts` (quest'ultimo era già orfano); i getter dello store (`getPlayerById`/`getPlayersByIds`/`searchPlayers`) non avevano alcun consumer esterno e spariscono senza sostituto. Pagina evento riagganciata (`useEventPage`, `useEventPlayers` senza più la dipendenza tipata dallo store); i fallimenti di registrazione in waitroom ora mostrano un toast (prima erano scartati in silenzio).
- **Commander-decks migrata a Colada (2026-07-18):** query `['decks']` (lista unica, ora anche SSR — prima il fetch era solo client-side in `onMounted`) con derivazioni per-player (`usePlayerDecks`), usage per-player in query `['deck-usage', playerId]` (sostituisce la chiave asyncData `commander-decks-usage-by-player-*`), mutation con invalidazione di entrambe. Store `commander-decks.ts` eliminato; 7 consumer riagganciati (pagine decks/deck/player + `PlayerFilterSwitch`/`PlayerDeckCount`). Il mapping 409→`inUseError` è ora nel gestore della pagina player via `isConflictError` (`app/utils/error.ts`, condiviso con la pagina rulesets). Restano: players e il lato-lettura di events.
- **Cards & stats migrati a Colada (2026-07-18) — migrazione ADR-015 completa.** Le quattro letture rimaste convertite in-place (stesso nome esportato, `useAsyncData` → `useQuery`, nessun rename di file): `players/usePlayerStats.ts` (`['player-stats', playerId]`, più `useAllPlayerStats()` nuovo, `['all-player-stats']`), `commanders/useDeckStats.ts` (`['deck-stats', playerId, commander1Name]`), `commanders/useCommanderStats.ts` (`['commander-stats', commander1Name]` + `useAllCommanderStats()` → `['all-commander-stats']`), `players/usePlayerMatchHistory.ts` (`['player-match-history', playerId]`, `t()` catturato nel composable e passato come stringa già risolta — stesso vincolo i18n documentato in CLAUDE.md). `commanders/useCommanderCards.ts` (card Scryfall per singolo nome, `['commander-card', cardName]`) perde il pattern manuale `fetchAllData()` + `loading`/`error` ref + `watch()`/`onMounted()` lato consumer: ora due query reattive (una per commander) si rifetchano da sole al cambio nome; i 3 consumer (`pages/deck/[deckSlug].vue`, `pages/player/[slug]/deck/[deckSlug].vue`, `CommanderDeckCard.vue`) perdono ~15 righe di boilerplate ciascuno. Il fetch batch di `pages/decks/index.vue` (`fetchCommandersByNames` chiamato a mano dentro un `watch` su `selectedSort`, mai invalidato) diventa una query dedicata `useCommandersByNamesQuery` (`['commanders-by-names', sortedNameSet]`, `enabled` sul sort selezionato) — stessa semantica lazy-once-per-set, ma cache Colada condivisa invece di un ref locale alla pagina. Eliminati i 4 shim di re-export residui in `supabase/` (`usePlayerStats`, `useDeckStats`, `useCommanderStats`, `usePlayerMatchHistory` — le implementazioni vere erano già in `players/`/`commanders/`) e lo store `player-stats.ts`: la pagina `players/index.vue` legge `useAllPlayerStats().getStat`, con la stessa forma sincrona `(id, key) => number` per restare compatibile col prop-drilling verso `PlayersGrid`/`usePlayersFilter`. **Gli unici store rimasti in `app/stores/` sono `events.ts` (lifecycle) e i 4 session store** — nessun altro store Supabase in tutto il progetto.
- **Bugfix (2026-07-19): `refresh()` di Colada non forza il refetch.** Segnalato dall'utente: creare un evento richiedeva un refresh manuale della pagina per vederlo, a differenza delle leghe. Causa: `useQuery().refresh()` rifetcha solo se i dati superano lo `staleTime` (default 5s) — non è un refetch forzato come `queryCache.invalidateQueries()` usato dalle altre mutation Colada. `useEventsQuery`/`useEventStandingsQuery`/`useWaitroom` in `useEventPage.refreshAfterLifecycle()` e nella pagina lega usavano `.refresh()`; sostituito con `.refetch()` (aggiunto anche il return di `useWaitroom`, che esponeva solo `refresh`). Verificato dal vivo: creazione/eliminazione di un evento di test ora si riflette istantaneamente.
- **Event CRUD spostato su Colada mutation (2026-07-19).** `createEvent`/`updateEvent`/`deleteEvent` erano rimaste in `useEventStore` come `$fetch` diretti (letture già migrate, scritture no) — causa strutturale del bug sopra: nessuna invalidazione automatica, bisognava richiamarla a mano a ogni call site. Estratte in `event/useEventMutations.ts`, stesso template di leghe/regolamenti/deck/giocatori (`useMutation` + `onSettled: invalidate` su `['events']` e `['league-standings']`, quest'ultimo perché l'eliminazione di un evento cambia l'aggregato sommato). `useEventStore` resta solo la macchina a stati del lifecycle (`startEvent`/`nextRound`/`turnBackRound` + seam `save*`) — orchestrazione multi-step che non si presta alla forma "singola entità" di una mutation. Verificato dal vivo (create/update/delete di un evento di test, tutte istantanee).

### ADR-016 — Catalogo comandanti: RPC `json_agg` + persistenza Colada per tutte le query

- **Contesto:** indagando sul bug "Candlekeep Sage non riconosciuta come Background", scoperto che `useCommanderWhitelists` caricava `mtg_commanders` (2986 righe) con un plain `select()` — PostgREST tronca silenziosamente a 1000 righe, quindi ~2000 comandanti (incluse molte Background) erano invisibili alla whitelist di validazione del secondo comandante. Corretti anche 31 comandanti "Choose a Background" con `partner_type` NULL in DB (UPDATE diretto, approvato dall'utente). Oltre al bug, la modale comandante rifaceva tutte le query ad ogni apertura e `useCommanderSearch` interrogava il DB a ogni tasto premuto in autocomplete.
- **Decisione:** una funzione Postgres `get_commander_catalog()` (`supabase/migrations/20260721000000_add_commander_catalog_rpc.sql`) aggrega l'intero catalogo in un unico valore JSON via `json_agg(row_to_json(t))` — PostgREST vede una sola "riga" nella risposta, bypassando il cap dei 1000 record in un'unica richiesta invece delle 3 del loop `.range()` provvisorio. Lato client, `useCommanderCatalogQuery()` (`app/composables/commanders/useCommanderCatalogQuery.ts`) è una query Colada con `staleTime`/`gcTime` a 30 giorni (i dati cambiano solo dopo un resync Scryfall o una correzione manuale) più un pulsante di refresh manuale in `CommanderModal.vue`. `useCommanderWhitelists.ts` e `useCommanderSearch.ts` sono stati riscritti per derivare tutto da questa query condivisa invece di interrogare Supabase ciascuno per conto proprio (filtro/ordinamento ora client-side su dati già in cache).
- **Persistenza allargata a tutte le query Colada, non solo al catalogo:** installato `@pinia/colada-plugin-cache-persister` (ufficiale, compatibile con `@pinia/colada@^1.4.2` già in uso), configurato in `colada.options.ts` **senza `filter`** — decisione rivista rispetto al piano iniziale (che limitava la persistenza al solo catalogo): questa è un'app usata dal vivo ai tornei, spesso su wifi di sede inaffidabile. Per standings/pairings (staleTime di default Colada, 5s) la persistenza non evita un refetch (parte comunque quasi subito), ma mostra l'ultimo dato noto istantaneamente dopo un reload invece di uno stato vuoto/di errore, e lo lascia visibile se il refetch fallisce per mancanza di rete. Il catalogo comandanti resta il caso con staleTime/gcTime mensile — l'unico dove la persistenza serve anche a evitare il refetch, non solo a dare resilienza al reload.
- **Nessuna sovrapposizione con `getCached`/`setCached`:** valutato e scartato di consolidare i due meccanismi — vedi `docs/architecture/client-caching.md` per il confronto completo. Chiavi `localStorage` diverse (`league-colada-cache` vs `event-session-${eventId}`), nessuna interazione: il persister Colada cachea dati letti da query, `getCached`/`setCached` (unico chiamante rimasto: `useSessionStorePersistence.ts`) specchia stato mutabile locale (i 4 session store) che non ha alcuna query dietro.
- **File coinvolti:** `supabase/migrations/20260721000000_add_commander_catalog_rpc.sql`, `colada.options.ts`, `app/composables/commanders/useCommanderCatalogQuery.ts` (nuovo), `useCommanderWhitelists.ts`/`useCommanderSearch.ts` (riscritti), `useCommanderCards.ts` (`fetchCommanderByName` esportata), `CommanderModal.vue` (pulsante refresh), `shared/utils/types/database.ts` (rigenerato), `docs/architecture/client-caching.md` (nuovo), `docs/architecture/stores.md` (sezione kills store disallineata dalla rimozione di `confirmedPairings`, corretta in questa stessa sessione).

### ADR-017 — Niente numero di posto fisso per giocatore all'interno di un tavolo (deciso, non implementato)

- **Domanda:** l'utente ha chiesto se i giocatori dovrebbero avere un numero di posto fisso all'interno di un tavolo, per sapere esattamente dove sedersi.
- **Decisione: no.** Commander/EDH non ha alcuna regola che leghi turno di gioco o punteggio a un posto fisico specifico — l'unica cosa che conta per il pairing è l'assegnazione al tavolo (chi gioca con chi), non l'ordine dei posti attorno ad esso. Chi si siede dove viene normalmente deciso dai giocatori stessi in pochi secondi al tavolo. `Seat` (`shared/utils/types/index.ts`) ha già solo un `id` interno (mai mostrato in UI, es. `table-3-seat-2`) e un `player` — non esiste né è mai esistito un concetto di "numero di posto" mostrato all'utente; l'unico badge per-giocatore è `seed` (`TableSeatItem.vue`), che è il seed di seeding torneo, non una posizione fisica.
- **Perché non aggiungerlo:** sarebbe complessità reale (modello dati, UI, semantica quando i giocatori vengono trascinati tra tavoli) per un problema non confermato — nessuna evidenza di confusione reale ai tavoli durante gli eventi. Riconsiderare solo se emerge un problema concreto (es. eventi grandi con caos su chi siede dove).

### ADR-018 — Pagina comandante singolo (BACKLOG #10, completo)

- **Contesto:** `/decks` è deduplicato per **coppia** di comandanti (`commander_1_name + commander_2_name`), backed da `commander_stats` (anch'essa per-coppia) — un comandante giocato sia da solo sia in coppia (es. "A" da solo, poi "A + B") appariva come due righe scollegate, mai aggregate in un'unica vista "A".
- **Decisione:** nuova pagina di dettaglio `app/pages/commander/[commanderSlug].vue` + `app/composables/commanders/useCommanderAggregate.ts` (`aggregateSingleCommander()`, `getAllCommanderNames()`), più una pagina indice `app/pages/commanders/index.vue` (elenco alfabetico con ricerca, linkata dalla home). Aggregazione **client-side** sopra `commander_stats` già cachata (non una nuova vista/RPC Postgres): la tabella ha solo 162 righe oggi, ben sotto il cap di 1000 righe di PostgREST, quindi un secondo aggregate lato client sulla stessa query già in cache (`useAllCommanderStats`) è stato più semplice di una migrazione. `averageScore` è una media pesata sul `match_count` di ogni coppia, non una media semplice delle medie — una coppia giocata una sola volta non deve pesare quanto una giocata 50 volte.
- **Risoluzione slug → nome esatto:** lo slug viene confrontato contro **entrambi** gli slot (`commander_1_name`/`commander_2_name`) di ogni mazzo in `useDecksQuery()`, non solo il primo — il comandante può comparire in entrambe le posizioni a seconda della coppia. I link verso le pagine mazzo per-giocatore usano sempre lo slug basato su `commander_1_name` del mazzo specifico (l'unico garantito a risolvere, per come `player/[slug]/deck/[deckSlug].vue` fa già il matching).
- **Limite noto, non un bug:** `playerCount` somma il conteggio di ogni coppia — un giocatore che ha usato lo stesso comandante con due partner diversi viene contato due volte. Un conteggio reale di giocatori distinti richiederebbe una query su `round_results`, non solo sommare la vista pre-aggregata; lasciato come limite documentato in `useCommanderAggregate.ts` invece di aggiungere quella query per una prima versione.
- **Pagina indice deliberatamente minimale:** niente art Scryfall per-riga (fetch pesante moltiplicato per ogni nome distinto), solo nome + ricerca client-side — coerente con l'ambito richiesto ("una pagina", non l'intera UX di `/decks` con ordinamenti multipli). Linkata da `/deck/[deckSlug].vue` ("Statistiche individuali" per ciascuna metà della coppia) e dalla home (`index.vue`).
- **BACKLOG #10 rimosso** — entrambe le metà (pagina dettaglio + indice) sono complete.

### ADR-019 — Winner checklist in-room (BACKLOG #15, metà completa)

- **Contesto:** dopo ogni round, il vincitore di ogni tavolo riceve un booster pack fisico — serviva un pannello "chi ha vinto questo tavolo" per l'organizzatore, con stato di spunta persistente per sapere chi ha già ricevuto il proprio.
- **Decisione:** `WinnerChecklist.vue` + `useWinnerChecklist.ts` (`app/composables/event/useWinnerChecklist.ts`). I vincitori sono derivati **live** da `rankingsStore` (rank === 1 per pairing), nessun nuovo stato DB — un pairing "Patta" (draw, tutti i giocatori seduti a rank 1) viene escluso tramite lo stesso `isPairingDraw` già usato da `PairingsCard.vue`, così le due viste concordano su cosa conta come pareggio. Il numero di tavolo segue la stessa convenzione "indice array + 1" usata ovunque altrove (vedi BACKLOG #14 sul perché è implicita).
- **Persistenza check-off:** lo stato "booster consegnato" per giocatore è mirrorato in `localStorage` via `getCached`/`setCached`, chiave `winner-checklist-${eventId}-${round}` (si azzera da sola ogni round), letto in `onMounted()` per evitare mismatch di idratazione SSR — stesso pattern di `useWaitingListFlags.ts`. Vedi `docs/architecture/client-caching.md`.
- **Non ancora fatto:** la seconda metà del BACKLOG #15 (persistenza dello stat "table_wins" su `player_stats`) resta da implementare — l'item BACKLOG non va rimosso, solo la parte checklist è completa.

### ADR-020 — Standings ricalcolate da zero invece di sommate (fix doppio conteggio, BACKLOG #11/#12)

- **Bug:** dopo un "torna indietro" di round seguito da un nuovo "avanza round" (anche senza modifiche), il punteggio di quel round veniva sommato una seconda volta a `standings` — `fetchRoundData` (`shared/utils/roundScoring.ts`) seedava l'accumulatore dai valori **già persistiti** e recuperava solo il round in chiusura, mentre `turn-back-round.post.ts` non annullava mai quel contributo. Scoperto durante l'audit di `fallow:health` (file senza test), documentato in `docs/TODO.md` #11 prima del fix.
- **Fix:** `fetchRoundData` ora recupera **tutti** i pairing/round_results fino al round corrente incluso (`.lte('pairing_round', currentRound)`, prima `.eq(...)`) e inizializza l'accumulatore a zero invece che dai valori persistiti — quindi ogni chiamata ricalcola il totale assoluto da zero su tutti i round chiusi finora. `updateStandingsAndRanks` scriveva già valori assoluti (non incrementali), quindi non ha richiesto modifiche: il fix è bastato lato lettura/accumulo. Risultato: `advance-round` è ora idempotente rispetto a retry e a cicli turn-back/re-advance — chiude anche il bullet `advance-round` di BACKLOG #12 (restano aperti solo i bullet `start` e round-result duplicati, senza relazione con questo bug).
- **`turn-back-round.post.ts` non modificato**: già non toccava `standings` nel branch round>1 — con `advance-round` ora idempotente, il prossimo "avanza round" si autocorregge da solo ricalcolando sui pairing/round_results rimasti dopo la cancellazione del round riaperto. Aggiunto solo un commento esplicativo.
- **Test**: aggiunti 12 unit test in `test/unit/shared/utils/roundScoring.test.ts` per le funzioni pure (`buildRoundOneTables`, `buildPairingRows`, `calculateRoundScores`) — coprono split tavoli, pareggi di posizione, pesi kill/brew/play. **Non coperte**: le 3 funzioni che chiamano Supabase direttamente (`resolveEventRuleset`, `fetchRoundData`, `updateStandingsAndRanks`) — il progetto non ha ancora un pattern per mockare il client Supabase nei test unitari; lasciato come lavoro futuro separato.

### ADR-021 — `CommanderSearch` migrato a `USelectMenu`, gruppo "mazzi già usati"

- **Contesto:** `CommanderSearch.vue` era un combobox scritto interamente a mano (`UInput` + lista suggerimenti posizionata `absolute`, navigazione da tastiera custom in `handleKeydown`/`navigateSuggestions`/`selectCurrent`/`closeSuggestions`). `useCommanderSearch.ts` già ordinava i comandanti già giocati dal player in cima alla lista (`reorderByPlayerUsage`), ma mescolati nella stessa lista piatta, non separati visivamente.
- **Decisione:** sostituito con `USelectMenu` di Nuxt UI — `ignore-filter` + `v-model:search-term` per riusare il filtro client-side già esistente sul catalogo cachato, navigazione da tastiera/a11y nativa, `value-key="label"` per mantenere l'API esterna (`v-model` stringa) invariata su `CommanderModal.vue`. `useCommanderSearch.ts` ora produce **gruppi** (`suggestionGroups: CommanderSuggestionItem[][]`) invece di una lista piatta con `suggestionMeta` separato — un gruppo "Mazzi già giocati" (solo se non vuoto) seguito dal resto, sfruttando il supporto nativo di `USelectMenu` per array-di-array con item `type: 'label'` come intestazione.
- **Bug corretto nello stesso passaggio:** i suggerimenti non comparivano finché l'utente non digitava (query vuota → lista svuotata), e non si aggiornavano se cambiava solo la whitelist (es. cambio comandante1) a query invariata. Ora un `watch([query, whitelist], ..., { immediate: true })` ricopre entrambi i casi — una whitelist corta (es. "30 carte compatibili" per un Background) è sfogliabile subito all'apertura, senza digitare nulla.
- **Rimosso**: l'evidenziazione del testo cercato (`highlightMatch`) — `USelectMenu` non la supporta nativamente e non è stata considerata essenziale abbastanza da giustificare uno slot custom aggiuntivo.

### ADR-022 — Layout 50/50 + motion per il secondo comandante

- `CommanderModal.vue`: i campi comandante1/comandante2 ora stanno affiancati (`flex-1` ciascuno) invece che impilati, e il badge "N carte compatibili" è stato spostato accanto all'etichetta (era su una riga propria, spingeva il campo di ricerca più in basso).
- Il campo del secondo comandante compare/scompare con un fade + slide laterale (`<Motion>`/`<AnimatePresence>`, pacchetto `motion-v` — già una dipendenza installata ma mai usata prima in questa sessione) in base al partner type del primo comandante.

### ADR-023 — Bracket level (1-5) per mazzo

- **Cosa:** i giocatori possono ora auto-assegnare un bracket Commander ufficiale (1 Esibizione, 2 Base, 3 Potenziato, 4 Ottimizzato, 5 cEDH) a un proprio mazzo — colonna opzionale `commander_decks.bracket_level` (`SMALLINT`, `CHECK BETWEEN 1 AND 5`, nullable), migrazione `20260722000000_add_deck_bracket_level.sql`.
- **UI:** un'unica `BracketPickerModal.vue` (5 card selezionabili con nome/esperienza/regole deck-building, tradotte in italiano) raggiungibile da due punti — un chip cliccabile su `CommanderDeckCard.vue` (solo in modalità non-aggregata: il bracket è per-giocatore, non ha senso su `/decks` in vista aggregata multi-giocatore) e una riga in `DeckEditModal.vue`. Entrambi salvano subito tramite la propria mutation, non agganciati al submit del form di `DeckEditModal`.
- **`app/utils/bracketLevels.ts`**: `BRACKET_LEVELS` generato programmaticamente dal pattern fisso `bracket.level${n}.xxx` (non 5 oggetti scritti a mano — elimina il rischio di un numero/chiave disallineati per un copia-incolla sbagliato), `BRACKET_COLORS` mappa ogni livello a un colore semantico Nuxt UI (success→info→primary→warning→error, progressione casual→competitivo) usando i token già in `app.config.ts`.
- **Refactor collaterale**: estratto `app/utils/semanticColor.ts` (`SemanticColor`) dal tipo `PlayerColor` di `playerColor.ts`, che duplicava la stessa union di 6 colori — ora entrambi i moduli riusano un'unica definizione.

### ADR-024 — Un solo componente per la classifica: `/league/:id` e la pagina evento condividono `StandingsCard`

- **Contesto:** `/league/:id` (classifica cross-evento, dati statici da `useLeagueStandingsQuery`) e la pagina evento (`liveStandings`, un'anteprima live che somma in tempo reale il round ancora in corso) mostravano la stessa "riga di classifica" con due componenti diversi — `LeagueRanking.vue`/`LeagueStandingsCard.vue` (tabella `UTable`+colonne TanStack) contro `StandingsCard.vue` (righe `v-for` scritte a mano, collassabile, badge "Inserito", statistiche extra in developer-mode). La rappresentazione era già divergente prima ancora del tipo dati: `StandingsCard.vue` definiva localmente un'interfaccia `Standing` che duplicava a mano `StandingWithPlayer` (`shared/utils/types/index.ts`) invece di importarla.
- **Decisione:** unificato tutto su `StandingsCard.vue` — `LeagueRanking.vue` e `LeagueStandingsCard.vue` eliminati, `league/[id].vue` ora chiama `<StandingsCard :title :standings>` direttamente, stesso componente usato dalla pagina evento. `StandingsCard.vue` importa `StandingWithPlayer` invece di ridefinirlo. Rimosso il wrapper `h-full`/`overflow-hidden` che forzava l'altezza della vecchia card di lega a corrispondere alla lista eventi accanto — `StandingsCard` non ha quel comportamento (si adatta al contenuto come già fa nella pagina evento), scelto di non reintrodurlo per non complicare il componente condiviso con un layout specifico di un solo consumer.
- **Chiavi i18n rimosse** (orfane dopo la rimozione di `LeagueRanking.vue`): `league.ranking.rank`, `league.ranking.points`, `league.ranking.pointsAbbrev`. `league.ranking.player`/`playerFallback`/`empty` restano — usate anche altrove (`EventRanking.vue`, `WaitingList.vue`, ecc.).

### ADR-025 — Lifecycle hardening: `viewedRound` reset + vincoli di idempotenza DB (BACKLOG #12, TODO #12)

- **`viewedRound` non si resettava** (TODO #12): `useEventLifecycle.ts`'s `resetSessionStores()` (già chiamata dopo ogni transizione `nextRound`/`turnBackRound`/`startEvent` riuscita) ora chiama anche una nuova dipendenza `clearViewedRound` — un solo punto invece di tre call-site separati, dato che `resetSessionStores()` era già il filo comune tra `confirmEndEvent`, il ramo avanza-round di `handlePreviewConfirm`, e `confirmCancelRound`.
- **Vincoli `UNIQUE` mancanti** (BACKLOG #12): aggiunti `standings(event_id, player_id)` e `round_results(pairing_id, player_id)` (migrazione `20260722010000_...`). **Non era più solo un rischio teorico**: trovate 2 righe duplicate reali già in produzione (`round_results`, `pairing_id 1152`, evento disposable "TEST EVENTO") — copie byte-identiche, ripulite (tenuto l'id più basso) prima di applicare il vincolo.
- **`start.post.ts`**: cattura il codice Postgres `23505` (unique_violation) sull'insert di `standings` e risponde con un 409 pulito invece di un 500 grezzo — un retry/doppio-click ora fallisce in modo prevedibile.
- **`upsertRoundResult`** (`server/utils/roundResults.ts`): riscritto da select-then-insert-or-update (race TOCTOU reale, causa della duplicazione trovata sopra) a un singolo `.upsert(..., { onConflict: 'pairing_id,player_id' })` atomico, appoggiato sul nuovo vincolo.

### ADR-026 — "Eventi validi" spostato da `rulesets` a `leagues`

- **Perché**: un ruleset è condiviso da più leghe (`leagues.ruleset_id`, relazione many-to-one — confermato da `LeaguesUsingRulesetModal.vue`), ma due leghe con lo stesso regolamento di punteggio possono avere stagioni di lunghezza completamente diversa (una fa 4 tappe, un'altra 10). Il numero minimo di eventi validi per la classifica finale è quindi una proprietà della stagione (lega), non delle regole di punteggio (ruleset) — tenerlo sul ruleset forzava ogni lega che lo condivide alla stessa soglia.
- **Cosa**: migrazione `20260726000000_move_valid_events_to_leagues.sql` — aggiunge `leagues.valid_events` (integer, nullable), fa il backfill dal `rule_set_valid_events` del ruleset attualmente associato a ciascuna lega, poi elimina `rulesets.rule_set_valid_events`. Il campo non era ancora agganciato al calcolo della classifica finale (`useLeagueStandingsQuery` somma tutti gli eventi senza filtrare) — spostamento a costo zero lato logica di scoring.
- **UI**: il campo "Eventi validi richiesti" si è spostato da `RulesetFormModal.vue`/dettaglio regolamento (`rulesets.vue`) al form lega (`LeagueFormModal.vue`); `LeagueFormPayload`/`leagueFormBodySchema` estesi con `validEvents`. Chiavi i18n spostate da namespace `ruleset.*` a `league.form.validEventsLabel`.

### ADR-027 — Ordinamento "Mazzi già giocati" nella ricerca comandanti: per recency, non per popolarità

- **Cosa**: nel gruppo "già giocati" della USelectMenu comandanti (`useCommanderSearch.ts`), l'ordinamento per rilevanza/`edhrecRank` usato per il resto del catalogo viene ignorato — il gruppo è ordinato per il giorno (UTC) più recente in cui quel comandante è stato giocato da quel giocatore, decrescente; a parità di giorno il tie-breaker è il numero di volte giocato in quel giorno, decrescente.
- **Come**: `fetchUsedCommanders` non ritorna più un semplice `Set<string>` di nomi ma una `Map<string, { lastPlayedDay, count }>`, popolata da una query con embed Supabase (`round_results` → `pairings(pairing_datetime)`, via la FK `round_results_pairing_id_fkey` già esistente) invece della sola `round_results.select('commander_1, commander_2')` di prima — serve la data della pairing, non presente su `round_results`. Nuovo comparator `byRecency` (stringhe `YYYY-MM-DD` confrontate lessicograficamente, che per date ISO zero-padded equivale all'ordine cronologico) sostituisce `byRelevance` solo per la lista `used`; `rest` resta ordinata per rilevanza/popolarità come prima.
- **UX collaterali nella stessa sessione**: `CommanderSearch.vue`'s `USelectMenu` ora si apre subito con focus sulla ricerca (`default-open`/`autofocus`, prima serviva un click extra) e mostra più risultati senza scroll (`max-h-96` invece del default `15rem`/~5 righe); aggiunta intestazione "Tutti i comandanti" al gruppo non-già-giocati (prima senza titolo). `CardPreview.vue` e il messaggio "non supporta un secondo comandante" in `CommanderModal.vue` ora riservano sempre il loro spazio esatto (opacity-toggle invece di `v-if`, dimensioni calcolate: card `w-64 aspect-5/7` = 358px di altezza + padding/margin) invece di un `min-h-[60vh]` indovinato su tutto il body della modale (`EventCommanderModal.vue`, rimosso) — la modale non salta più né è vuota quando non c'è ancora una card selezionata.
- **Fix cache fredda**: `useCommanderSearch.ts` ricalcola anche quando `catalog` (Colada) arriva dopo il primo giro — prima, se il catalogo comandanti non era ancora caricato all'apertura della modale, "già giocati" restava vuoto finché l'utente non digitava e cancellava un carattere per forzare un secondo giro.

### ADR-028 — Prefetch batched di `useCommanderUsageQuery` per round (2026-07-26)

- **Perché**: prima, ogni apertura della modale comandanti sparava una query `round_results`+`pairings` filtrata su un singolo `player_id` — uno spinner ad ogni apertura, N richieste per un tavolo da N giocatori. Segnalato come TODO ("Prefetch commander usage per table") e implementato su richiesta esplicita nella stessa sessione.
- **Cosa**: nuovo `useCommanderUsageQuery.ts` (Pinia Colada `useQuery`, key `['commander-usage', ...sortedPlayerIds]`) batcha l'uso pregresso di più giocatori in una sola richiesta (`.in('player_id', playerIds)`). `PairingsCard.vue` la chiama con l'intero roster del round (`pairings.flatMap(getPairingPlayerIds)`) al mount, come prefetch "fire and forget" — nessun consumo del valore di ritorno lì, serve solo a scaldare la cache Colada prima che l'utente clicchi. La pagina evento passa lo stesso identico roster (`commanderModalTablePlayerIds`, l'intero round non solo il tavolo) a `EventCommanderModal` → `CommanderModal` → `CommanderSearch` → `useCommanderSearch`, che ora chiama la stessa query invece di fare il proprio fetch — la chiave coincide, quindi la seconda apertura (e tutte le successive nello stesso round) leggono dalla cache già risolta, zero round-trip di rete.
- **Invalidazione**: `useEventSubmitHandlers.ts`'s `handleCommanderSubmit` invalida `['commander-usage']` (prefix match, Colada) dopo un salvataggio comandante riuscito — senza, un comandante salvato in sessione non sarebbe comparso in "già giocati" per gli altri giocatori dello stesso round finché la cache non fosse scaduta naturalmente (era il trade-off segnalato nel TODO originale, ora risolto invece di accettato).
- **Perché "per round" e non "per tavolo" come chiesto alla lettera**: la chiave della query deve combaciare esattamente tra il prefetch e la lettura per condividere la cache — batchare per round (una sola lista, nota sia a `PairingsCard` che alla pagina) garantisce l'hit ovunque nello stesso round con una sola richiesta, invece di una richiesta per tavolo (comunque netto miglioramento, ma N richieste anziché 1 per round).

### ADR-029 — Punteggio round: posizioni dense a riposo, skip-rank derivato in lettura; "Patta" non assegna vittorie (2026-07-26)

- **Perché**: `useRankingGrid`/`TableScoreGrid` impongono volutamente che le posizioni salvate su `round_results.position` siano sempre "dense" e contigue (`1,1,2,3`, mai `1,1,4,4`) — è l'unico modo per cui la griglia drag-and-drop resta priva di ambiguità (un giocatore trascinato in riga 3 *è* 3°, nessun buco possibile) e per cui il dato salvato è auto-descrittivo (il valore massimo coincide sempre col numero di giocatori seduti, non serve saperlo a parte per interpretarlo). Verificato su richiesta esplicita che questa scelta di storage non introducesse un bug di punteggio: **non era equivalente**. `calculateRoundScores` indicizzava `posValues` con la `position` grezza, quindi un pareggio dense (`1,1,2,3`) e il suo equivalente skip-rank (`1,1,3,4`) — identici come piazzamento reale — producevano punteggi diversi.
- **Cosa (fix 1 — skip-rank spacing)**: `calculateRoundScores` (`shared/utils/roundScoring.ts`) ricalcola una `effectivePosition` per ogni giocatore — `1 + (numero di risultati con position < position corrente)` — e la usa al posto della `position` grezza per indicizzare `posValues`. Questo fa sì che una griglia dense `1,1,2,3` scori esattamente come lo skip-rank equivalente `1,1,3,4` (e `1,1,1,2` come `1,1,1,4`, `1,2,2,3` come `1,2,2,4`) — lo storage resta dense e privo di ambiguità, la semantica di scoring da torneo (che richiede skip-rank) è derivata a runtime invece che duplicata in ogni writer. Coperto da 3 nuovi test in `roundScoring.test.ts`.
- **Cosa (fix 2 — "Patta" non vale come vittoria)**: la "Patta" (`handleDrawSubmit`/`PairingTableActions.vue`) salva zero uccisioni per tutti e tutti pareggiati in 1ª posizione — prima dell'analisi, questo veniva contato come una vittoria condivisa per l'intero tavolo (`position === 1` per tutti). Correzione del modello di dominio: in Commander il vincitore del tavolo è l'ultimo giocatore rimasto vivo a fine round — una patta significa che nessuno lo è stato, quindi nessuno ha effettivamente vinto. `calculateRoundScores` ora calcola `isDraw` per tavolo (tutti i risultati `position === 1` **e** tutte le uccisioni a zero — stessa definizione di `isPairingDraw` in `app/utils/pairingDraw.ts`, non riusata direttamente perché `app/utils/` non è isomorfo mentre `shared/utils/` sì) e nega il conteggio vittoria quando vero. Il punteggio numerico non cambia (una patta pareggiata in 1° resta comunque una media dei rank consumati) — cambia solo `victories`. Coperto da un nuovo test dedicato.

### ADR-030 — Elenco leghe ordinato per data di inizio, più recenti/vicine per prime

- **Cosa**: `useLeaguesQuery.ts` ordina `leagues` per `starts_at` discendente (`{ ascending: false }`) — la lega con la `starts_at` più recente (tipicamente la stagione corrente o la prossima) compare per prima nell'elenco, le più vecchie in fondo. Era già il comportamento di default; confermato esplicitamente dopo un tentativo di invertirlo a `ascending: true` (crescente in senso stretto = più vecchie per prime), scartato perché non corrispondeva all'intento reale ("mostra prima le più vicine/recenti"). `useLeaguesQuery` è la cache unica per le leghe (ADR-015); nessun consumatore (`useLeaguesPage.ts`, `useRulesetsPage.ts`) riordina o inverte il risultato, quindi l'ordinamento si propaga a ogni vista senza altre modifiche.

### ADR-031 — Modali round separati (Score/Kill/Patta vs Commander/Votes) in vista della futura auto-compilazione lato player (2026-07-26)

- **Perché**: discutendo una possibile semplificazione della UI di round (`/league/:leagueId/event/:eventId?phase=playing`), è emerso che la scelta di avere modali indipendenti per Score, Commander, Votes e Kill (`EventScoreModal`, `EventCommanderModal`, `EventVotesModal`, `EventKillModal`, aperti da `PairingsCard.vue`) non è casuale: è pensata per una direzione futura in cui **comandante e voti (deck/play) verranno compilati direttamente dai giocatori**, mentre l'admin di sala continuerà a gestire solo piazzamento (Score), uccisioni (Kill) e Patta. I confini dei modali attuali rispecchiano già quel futuro confine di responsabilità admin/player.
- **Cosa (deciso, non implementato)**: non consolidare `EventCommanderModal`/`EventVotesModal` in un flusso admin unico — andrebbe smontato di nuovo quando il self-service lato player sarà implementato. Un'eventuale semplificazione della UI di round va cercata solo nella parte che resta stabilmente admin (Score + Kill + Patta), ad es. valutando se questi due/tre possano condividere un solo modale invece di restare separati.
- **Da rivedere quando**: il self-service player per comandante/voti verrà effettivamente implementato — a quel punto verificare chi apre `EventCommanderModal.vue`/`EventVotesModal.vue` prima di assumere che questo ADR sia ancora valido.

### ADR-032 — Card "Stato inserimento" nella sidebar della fase playing; filtro "In corso" rimosso perché senza segnale reale (2026-07-26)

- **Cosa**: nuova `RoundStatusCard.vue` (`app/components/event/round-status/`) nella colonna destra della fase `playing`, sopra `WinnerChecklist` — elenca, per le 4 categorie classifiche/uccisioni (per tavolo) e comandanti/voti (per giocatore), cosa è stato inserito e cosa manca, con click diretto sulla modale corrispondente, un filtro di stato e una ricerca per nome giocatore o numero/etichetta tavolo ("1" o "Tavolo 1"). Le predicate di completamento (`hasRanking`/`hasKills`/`isDraw`/`isTableComplete`), prima locali a `PairingsCard.vue`, sono state estratte in `useTableCompletion.ts` così le due viste concordano sempre sulla stessa definizione di "fatto"; le 4 liste vengono da `useRoundStatus.ts`, il filtro/ricerca da `app/utils/roundStatusSearch.ts` (estratto apposta per essere testabile senza montare il componente — coperto da unit test insieme ai due composable).
- **Filtro "In corso" rimosso**: la card è nata con 3 stati (Da fare / In corso / Fatto), ma "in corso" non aveva alcun segnale distintivo — non tracciamo chi sta compilando in tempo reale, quindi si comportava esattamente come "Da fare" e poteva sembrare un bug più che una funzione. Rimosso lo stesso giorno in cui è stato aggiunto: resta solo il filtro binario Tutti/Da fare/Fatto.
- **Da rivedere quando**: se in futuro arriverà un segnale realtime di "chi sta inserendo dati adesso" (verosimilmente insieme al self-service player di ADR-031, o a una sottoscrizione Supabase Realtime — vedi la nota su `hydrate()` in `app/stores/CLAUDE.md`), varrà la pena reintrodurre uno stato "In corso" reale in `RoundStatusFilter` (`app/utils/roundStatusSearch.ts`). Non è un lavoro pianificato oggi, solo un'ipotesi — se diventa un impegno concreto, va spostato in `docs/BACKLOG.md`.
- **Consolidamento "classifica completa" con `StandingsCard`'s "Inserito"**: emerso chiedendosi su cosa si basasse il badge "Inserito" di `StandingsCard.vue` (`submittedByPlayerId`, da `buildStandingsSubmissionMap` in `app/utils/standingsSubmission.ts`) — usava una definizione di "tavolo classificato" diversa e più permissiva di `useTableCompletion.ts`'s `hasRanking` (quest'ultima controllava solo "esiste una classifica non vuota", non "ogni seduto è classificato"). Estratta la funzione pura `hasCompleteRanking(playerIds, rankedPlayerIds)` in `standingsSubmission.ts`, riusata sia da `buildStandingsSubmissionMap` sia dalla nuova `hasRanking(pairing)` di `useTableCompletion.ts` (che ora prende l'intero `pairing`, non solo `pairing_id`, per poter derivare i seated player). Le due funzioni restano concettualmente separate — "Inserito" (classifica+voti, il punteggio è affidabile) e "Tavolo completo" (classifica+comandante+voti, il lavoro dell'admin è finito) rispondono a domande diverse e non vanno fuse in un solo flag — ma condividono ora lo stesso controllo elementare "ogni seduto è stato classificato".

### ADR-033 — Fix: "Resetta tavolo" non azzerava kills/classifica/comandante/voti lato server (2026-07-26)

- **Bug**: `handleResetTable` (`[eventId].vue`) puliva solo lo stato locale (`rankingsStore`/`killsStore`/`commandersStore`/`votesStore`) — `round_results.number_of_kills`/`position`/`commander_1`/`commander_2`/`brew_vote`/`play_vote_1` restavano sul valore precedentemente salvato. Visibile subito su "Uccisioni" (letto da `pairing.round_results`, non dallo store — vedi `useTableCompletion.ts`), ma lo stesso vale per comandante/voti: la UI sembra vuota nella sessione corrente, ma il DB conserva ancora i vecchi valori finché non li si sovrascrive di nuovo.
- **Fix**: nuovo endpoint `server/api/pairings/[pairingId]/reset.post.ts` (azzera `round_kills` + tutte le colonne nullable di `round_results` per ogni seduto), nuova action `eventStore.resetPairing(pairingId)`, richiamata da `handleResetTable` dopo la pulizia locale (stesso pattern già usato da `handleUndrawTable`/`undrawPairing`, che invece lascia apposta comandante/voti intatti perché una Patta non li tocca mai — i due endpoint restano distinti per questo).
- **Controllo dati esistenti**: eseguita una query diagnostica una tantum (poi scartata) sul DB di produzione per cercare righe orfane/incoerenti prodotte dal bug (`round_results` con `pairing_id` nullo, righe con kills/posizione azzerati ma comandante/voti ancora presenti, `player_id` non seduto al tavolo della riga, `round_kills` che punta a pairing inesistenti) — **nessuna riga sporca trovata**, il bug non ha ancora lasciato residui in produzione.

### ADR-034 — Righe della modale "Punteggi Tavolo" ordinate per totale, con tie-breaker sul piazzamento (2026-07-27)

- **Cosa**: `buildTableScoreRows` (`app/utils/tableScoreRows.ts`) ora ordina le righe per `total` decrescente invece di lasciarle nell'ordine dei posti a sedere (`pairing_playerN_id`). A parità di totale, il criterio secondario è `placementPoints` decrescente — riflette il piazzamento reale in game (1°/2°/3°/4°) invece di un ordine arbitrario legato a dove il giocatore si è seduto.
- **Perché non un terzo tie-breaker**: `Array.prototype.sort` è stabile (garantito da ES2019), quindi un pareggio anche su `placementPoints` (es. patta con classifica dense) mantiene l'ordine naturale precedente (seat order) invece di un ordine indefinito — sufficiente per una tabella di sola visualizzazione, non serve altro criterio.
- **Nota**: questo è solo l'ordinamento della vista di dettaglio di un tavolo — non tocca `calculateRoundScores`/le standing reali dell'evento, che restano calcolate altrove con la propria logica di parità (vedi ADR-029).

### ADR-035 — Fix: drag-and-drop tra tavoli nella preview pairing (docs/TODO.md, HIGH PRIORITY) (2026-07-27)

- **Bug**: segnalato dall'utente, non ancora root-causato in sessioni precedenti (mancava accesso al browser). Riprodotto dal vivo con una lega/evento usa-e-getta (creati e poi eliminati) popolando la lista d'attesa con giocatori reali e testando il drag nella modale "Anteprima Tavoli".
- **Causa 1**: `TableCard.vue`'s `visibleSeats` renderizzava un array *derivato* da `props.table.seats`, mentre `v-model="seatsModel"` era legato a `props.table.seats` direttamente — `vue-draggable-plus` richiede che la lista renderizzata (`v-for`) e la lista del `v-model` siano lo stesso identico array. Fix: renderizzare `seatsModel` direttamente, `visibleSeats` eliminato (era comunque un no-op nell'invariante normale: una tabella piena non ha mai seat `player: null` da filtrare).
- **Causa 2**: `TablePreviewModal.vue`'s `updateTableSeats` assegnava l'array grezzo emesso da `VueDraggable` senza ri-normalizzarlo — trascinare un giocatore FUORI da un tavolo lo lasciava senza il seat placeholder `player: null`, quindi `TableSeatItem.vue` non renderizzava più nessuna "drop here" per un trascinamento *successivo*, anche se il tavolo non era pieno (solo apparentemente compatto). Fix: `updateTableSeats` spostata dentro `useTableDnd.ts`, ogni aggiornamento passa di nuovo per `normalizeSeats` (già usata da `ensureTableSeatShape`), che ripristina il padding a 4 posti.
- **Verificato dal vivo**: trascinamento da tavolo pieno (4/4) a tavolo con slot libero (3/4) completa correttamente in entrambe le direzioni; il tavolo sorgente ripristina il proprio slot libero. Il caso tavolo-pieno→tavolo-pieno resta correttamente rifiutato dal validator esistente (dimensioni tavolo non valide), non è un bug.
- **Test**: `test/unit/composables/tables/useTableDnd.test.ts`'s nuovo blocco `updateTableSeats` copre il re-padding dopo rimozione, l'inserimento fino a 5 occupanti mid-drag, e l'idempotenza su una forma già corretta.

### ADR-036 — Test E2E del lifecycle evento completo, a livello API (BACKLOG #1) (2026-07-27)

- **Cosa**: nuovo `test/e2e/event-lifecycle.e2e.spec.ts` — stesso pattern di `turn-back-round.e2e.spec.ts` (solo fixture `request`, nessun `page`/browser reale), copre l'intero ciclo: crea giocatori/lega/ruleset/evento (2 round) → registra → avvia (pairing round 1 generati) → invia un round completo (classifica, uccisioni, comandante, voti per tutti e 4 i giocatori) → avanza al round 2 → invia la classifica del round 2 → torna indietro dal round 2 (il ramo "riapri round precedente", **mai coperto prima** — `turn-back-round.e2e.spec.ts` esercita solo il ramo round-1-verso-registrazione) → riavanza → avanza oltre l'ultimo round (l'evento termina: `event_playing=false`, `event_current_round` oltre il totale). Tutte le entità sono usa-e-getta (taggate, cancellate in `afterEach` a prescindere dall'esito) — verificato che non lasciano residui in produzione con una query diagnostica una tantum poi scartata.
- **Bug pre-esistente scoperto e corretto nel processo**: `leagueFormBodySchema` (`server/utils/requestValidation.ts`) aveva reso `status` un campo **obbligatorio** (aggiunto in una sessione precedente per lo `USelect` di stato lega in "Modifica Lega") in uno schema condiviso da create *e* update — questo rompeva silenziosamente `POST /api/leagues/create` per qualunque chiamante che non lo invia esplicitamente, incluso il test E2E pre-esistente `turn-back-round.e2e.spec.ts` (mai stato eseguito con successo fino ad ora, dato che i browser Playwright non erano installati in sessioni precedenti). Fix: `status` reso opzionale con default `'scheduled'` — l'endpoint di creazione lo ignora comunque (hardcoda sempre `'scheduled'`), quindi renderlo obbligatorio non aveva senso lì.
- **Bug/test-rot pre-esistente scoperto ma non causato da questa sessione**: sia `turn-back-round.e2e.spec.ts` sia il nuovo test mancavano del campo `validEvents` nel payload di creazione lega, richiesto (anche se nullable) da `leagueFormBodySchema` — sistemato in entrambi i file.
- **Scelta API-level vs UI-level**: la strategia di test già decisa (`docs/BACKLOG.md` #1) distingue un livello "API/integration" (Playwright `request` diretto sugli endpoint, economico) da un livello "E2E" pieno (UI reale). Il lifecycle evento reale via drag-and-drop nella preview pairing, timer, modali resta scoperto — questa spec chiude il rischio più concreto (transizioni di stato/integrità dati), non l'intera interazione UI.
- **Ambiente**: i browser Playwright non erano installati in questo ambiente (`npx playwright install chromium` eseguito una tantum). Il dev server è dovuto essere riavviato due volte durante il debug perché l'HMR di Nitro non ricaricava `server/utils/requestValidation.ts` dopo la modifica — non affidarsi all'hot-reload per verificare un fix su file `server/utils/*` condivisi, riavviare per sicurezza.

### ADR-037 — Swap automatico trascinando un giocatore tra due tavoli pieni + `forceFallback` su VueDraggable (2026-07-27)

- **Richiesta utente**: con due tavoli pieni (4/4), spostare un giocatore dall'uno all'altro non era possibile — un semplice move lascia il tavolo di destinazione a 5 occupanti, quindi il validator esistente lo rifiutava correttamente come disposizione non valida (non era un bug, era il comportamento post-ADR-035). Scelta tra "swap automatico" e "permetti temporaneamente 5 giocatori a un tavolo": l'utente ha scelto lo swap automatico.
- **Cosa**: nuova funzione pura `attemptTableSwap(before, after)` in `useTableDnd.ts` — riconosce la forma "un tavolo è salito a 5 occupanti dopo il drag, quello di provenienza ne ha 3" e la trasforma in uno scambio a due vie: il giocatore trascinato nel tavolo pieno si scambia di posto con uno dei suoi occupanti preesistenti, riportando entrambi i tavoli a 4/4. Ritorna `null` se la forma non corrisponde (il chiamante ricade sul normale rifiuto/revert). Richiamata da `TablePreviewModal.vue`'s `handleDragEnd` **prima** del revert automatico esistente: se lo swap risolve l'arrangiamento, viene applicato; altrimenti il flusso invalid-move di ADR-035 resta invariato.
- **Test**: `test/unit/composables/tables/useTableDnd.test.ts`'s blocco `attemptTableSwap` (3 casi: swap riuscito, nessun overflow, tavolo overflow senza baseline) più un nuovo test E2E UI-driven `test/e2e/pairing-preview-swap.e2e.spec.ts` che riproduce lo scenario dal vivo (8 giocatori usa-e-getta, 2 tavoli pieni, drag reale nella modale, verifica che lo scambio avvenga senza il toast "Spostamento non valido").
- **`forceFallback: true` su `TableCard.vue`'s `VueDraggable`**: scoperto scrivendo il test E2E che questo drag-and-drop usa il drag nativo HTML5 del browser (comportamento di default di SortableJS, nessuna opzione impostata prima). Il drag nativo di Chromium non è guidabile in modo affidabile da Playwright — il drag parte davvero (l'elemento sorgente sparisce dal layout), ma i successivi `dragover`/`drop` cross-lista non vengono mai recapitati alla lista di destinazione, con qualunque tecnica (simulazione mouse, `dragTo()`, `DragEvent` sintetici via `page.evaluate`). Passare a `forceFallback: true` (drag simulato via eventi mouse, non drag nativo del browser) risolve il problema *e* è un piccolo miglioramento UX: `ghost-class`/`chosen-class` già configurate sono pensate proprio per questa modalità (in drag nativo il browser disegna la propria anteprima, che ignora `chosen-class`), quindi il comportamento visivo diventa più coerente cross-browser, non solo testabile. Discusso e approvato esplicitamente con l'utente prima di applicarlo, trattandosi di un cambiamento di comportamento reale e non solo di infrastruttura di test.

### ADR-038 — `isTableComplete` come unica definizione di "tavolo completo", estesa alle kills (2026-07-29)

- **Bug segnalato dall'utente #1**: il pulsante "Prossimo Round" restava disabilitato anche con tutti i dati dei tavoli inseriti. Causa: `canAdvance` in `[eventId].vue` reimplementava da zero la propria logica di completezza e, per le kills, leggeva `killsStore.kills` — un array piatto condiviso da qualunque modale kill sia correntemente aperto, non scoped per pairing (esattamente il caso che il commento di `useTableCompletion.ts` avvertiva di non fare). Cambiando tavolo, le kills confermate di un tavolo diverso da quello aperto per ultimo diventavano invisibili a `canAdvance`.
- **Bug segnalato dall'utente #2**: la voce "Inserito" nella classifica non teneva conto delle kills del tavolo — `buildStandingsSubmissionMap` (`standingsSubmission.ts`) controllava solo ranking + voti, mai le kills, nonostante la sua stessa entry nell'inventario `app/utils/CLAUDE.md` dicesse già (erroneamente) "rankings/votes/kills state".
- **Fix**: invece di correggere i due bug separatamente (rischiando di lasciare due definizioni di "completo" leggermente diverse, la stessa classe di bug appena risolta), `useTableCompletion.isTableComplete` è diventata l'unica definizione condivisa — ranking + comandante + voti + kills confermate (`hasKills`, letta da `round_results.number_of_kills !== null`, mai da `killsStore`). `canAdvance` ora chiama `isTableComplete` invece di reimplementarla; `buildStandingsSubmissionMap` è stata ridotta a un fan-out puro (pairing → giocatori) che riceve una mappa di completezza già calcolata da `isTableComplete`, invece di ricalcolare rankings/voti/kills al suo interno.
- **Effetto collaterale positivo**: `PairingsCard`'s badge per-tavolo, il pulsante avanza-round e il badge "Inserito" in classifica ora concordano sempre sulla stessa definizione — non possono più divergere silenziosamente come nei due bug sopra.
- **Test**: `useTableCompletion.test.ts` aggiornato (kills ora richieste da `isTableComplete`, nuovo caso "kills non confermate" nonostante ranking/comandante/voti completi); `standingsSubmission.test.ts` riscritto per il nuovo signature basato su `isCompleteByPairing`.

### ADR-039 — Fix: la modale "Punteggi Tavolo" non rifletteva subito classifica e voti appena salvati (2026-07-29)

- **Bug segnalato dall'utente**: la modale "Punteggi Tavolo" (`TableScoresModal.vue`, tramite `buildTableScoreRows`) legge i punti direttamente da `pairing.round_results` — non dagli store di sessione (`rankingsStore`/`votesStore`), che sono invece la fonte usata da `isTableComplete` (ADR-038). In `useEventSubmitHandlers.ts`, solo `handleKillsSubmit` chiamava `refreshDisplayedPairings()` dopo il salvataggio; `saveRanking` (classifica) e `handleVotesSubmit` (voti mazzo/giocata) aggiornavano solo lo store locale e mai il refetch della query `pairings`/`displayedPairings`. Risultato: dopo aver inserito classifica o voti, la modale continuava a mostrare i valori di `round_results` precedenti al salvataggio, finché qualcos'altro non forzava un refetch (es. un successivo submit delle kills).
- **Fix**: `saveRanking` e `handleVotesSubmit` ora richiamano `refreshDisplayedPairings()` in caso di successo, stesso pattern già usato da `handleKillsSubmit`. `handleCommanderSubmit` **non** ha ricevuto lo stesso trattamento: il comandante non entra in nessuna colonna di `buildTableScoreRows`/`calculatePlayerTableScore`, quindi un refetch lì non avrebbe cambiato nulla nella modale — l'unico cache invalidato dopo un salvataggio comandante resta `commander-usage` (già presente).
- **Verifica**: lint/typecheck/test suite completa verdi; nessun test dedicato aggiunto (nessun test esistente per `useEventSubmitHandlers.ts`, mock di store/eventStore/queryCache non giustificato per una singola chiamata di refetch aggiuntiva) — verifica manuale in browser rimandata all'utente.

---

## Funzionalità per area

| Area | Stato | Note |
|------|-------|------|
| Leghe + ruleset | ✅ Operativo | Modali create/edit/delete |
| Lista eventi per lega | ✅ Operativo | |
| Pagina evento — registrazione | ✅ Operativo | Waiting list, player search |
| Pagina evento — playing | ✅ Operativo | Pairings, score, kills, votes, commander |
| Pagina evento — ended | ✅ Operativo | |
| Preview / optimizer tavoli | ✅ Operativo | Modale complessa, preferenze in localStorage |
| Classifiche lega/evento | ✅ Operativo | |
| URL sync modali evento | ✅ Operativo | Non esteso a `leagues.vue` |
| Stepper fasi | ✅ Presente | `EventStepper.vue` |
| Round timer | 🟡 Presente, durata non ancora persistita | `RoundTimer.vue`; legge `event_round_duration`, ma la migrazione non è ancora applicata (vedi ADR-008) |
| Bracket level per mazzo | ✅ Operativo | `BracketPickerModal.vue`, vedi ADR-023 |
| Validazione form (valibot) | 🟡 Parziale | In uso in `EventFormModal` e altri (5 file); non su tutti i form |
| Test e2e Playwright | 🟡 Parziale | 4 spec (`league-crud`, `player-create`, `deck-create`, `turn-back-round`) — vedi `docs/BACKLOG.md` #1 per i flussi ancora scoperti |
| Test unitari | 🟡 Parziale | 113 test / 19 file — vedi `docs/architecture/testing.md` per il dettaglio per area |

---

## Qualità e tooling (2026-07-12)

| Comando | Stato |
|---------|--------|
| `pnpm lint` | ✅ 0 warning, 0 errori (vedi ADR-009) |
| `pnpm typecheck` | ✅ 0 errori — corretti due bug pre-esistenti non legati a questa sessione: mismatch di casing su `~/components/ui/*` (cartella reale `Ui/`) e alias `#test` mancante in `nuxt.config.ts` (risolveva solo lato vitest, non lato `nuxt typecheck`) |
| `pnpm test` | ✅ 113 test / 19 file (2026-07-22) |
| `pnpm fallow:dupes` | ✅ 0 clone groups (era 128 gruppi / 17.6% al 2026-07-13 mattina — vedi ADR-011) |
| `pnpm build` | ❌ **Rotto** — fallisce in prerender di `/` (`routeRules: { '/': { prerender: true } }`): `SyntaxError: The requested module 'vue/index.mjs' does not provide an export named 'default'` (ESM/CJS interop in Nitro). Non causato da questa sessione (nessuna modifica a Vue, `/`, o config di prerender) — probabile drift di dipendenze (Renovate). Da investigare. |

### Convenzioni codice — batch completati (2026-05-25)

- [x] Path comment su tutti i `.vue`
- [x] `defineProps` inline (nessun `interface Props`)
- [x] Migrazione `withDefaults` → destructuring (8 file)
- [x] Store Pinia uniformati a Setup API (4 store sessione migrati)
- [x] Typecheck: `@tanstack/vue-table` devDep + tipi Scryfall in `useCardWhitelists`
- [x] ~~Uniformato parametro route per lega a `[leagueId]`~~ — **non applicabile**: `app/pages/league/[id].vue` usa `route.params.id` per una ragione strutturale (route annidate non possono condividere lo stesso nome di parametro), non per un'incoerenza mai sistemata — vedi nota nella sezione Route sopra

### Batch completati (2026-07-12)

- [x] Rimossi tutti gli `any` residui da lint (`useCommanderCards`, `useCommanderSearch`, `usePlayerMatchHistory`, `usePairingsQuery`, `useStatsQueryBuilder`, `stores/events.ts`) con tipi reali da `#shared/utils/types`
- [x] Aggiunta colonna `event_round_duration` (migrazione + wiring form→store→DB, non ancora applicata al DB reale — ADR-008)
- [x] Documentato l'invariante di scoring del pairing optimizer (ADR-004)
- [x] Rimossa cartella shim `app/composables/events/` (re-export verso `event-pairing/`, non necessaria: progetto non pubblicato)
- [x] Creato `CLAUDE.md` alla radice del repo
- [x] Aggiunto TODO per Playwright + Playwright MCP in `docs/TODO.md`

Audit dettagliato: [`docs/audits/2026-05-24-skills-audit-report.md`](docs/audits/2026-05-24-skills-audit-report.md), checklist: [`docs/audits/skills-audit-checklist.md`](docs/audits/skills-audit-checklist.md) — **non riverificati in questa sessione**, possono essere datati. Vedi anche [`docs/audits/2026-07-12-vue-nuxt-conventions.md`](docs/audits/2026-07-12-vue-nuxt-conventions.md) per l'audit Vue 3.5+/Nuxt 4.

---

## Prossimi passi (storico, aggiornato 2026-07-20)

Questa lista risale al 2026-07-12/13 ed era rimasta non aggiornata da allora — molti item sono stati completati o superati nel frattempo. Il lavoro forward-looking attuale vive in `docs/BACKLOG.md`, non qui.

0. ~~`pnpm build` è rotto~~ — **risolto**: il build funziona (verificato più volte in questa sessione, incluso l'harness E2E che builda ripetutamente `.output/server/index.mjs`).
1. ~~Applicare la migrazione `event_round_duration`~~ — **risolto**: applicata e cablata end-to-end (form → mutation → schema server → DB → `RoundTimer`), verificato 2026-07-20.
2. **Rimuovere o centralizzare `console.log` di debug** — ancora aperto in piccola parte: `app/stores/events.ts` ha 7 `console.log` grezzi (righe 60-187) invece di `app/utils/logger.ts`. Minore, non bloccante.
3. ~~Decidere sul parametro route `[id]` vs `[leagueId]`~~ — **non era un'incoerenza**: vedi nota nella sezione Route sopra, chiuso definitivamente.
4. **Refactor pagina evento** — invariato: deciso il 2026-07-13 (ADR-011) di non spezzare forzatamente i file oltre le 250 righe, con ceiling espliciti in `.fallowrc.json`. Nessuna azione a meno che un file superi il proprio ceiling.
5. ~~Validazione con valibot sugli altri form modali~~ — **risolto**: tutte e 6 le modali form (`CreatePlayerModal`, `LeagueFormModal`, `RulesetFormModal`, `EventFormModal`, `DeckCreateModal`, `DeckEditModal`) usano valibot, verificato 2026-07-20.
6. ~~Test Vitest~~ / 7. ~~E2E Playwright~~ — **superati da `docs/BACKLOG.md` #1**, che ora è il tracker unico per la strategia di test a 3 livelli (unit/API-integration/E2E) e la checklist dei test mancanti.

**Nuovo, 2026-07-20 — audit di fragilità del lifecycle evento** (priorità corrente): bug confermati e rischi latenti su `advance-round`/`turn-back-round`/submission punteggi, tracciati in `docs/BACKLOG.md` #11-#13, da affrontare con approccio TDD (test che riproduce il problema prima del fix).
8. **Estendere URL sync** alle modali su `/leagues` (opzionale).
9. **Accessibilità** — review sistematica modali/tabelle (skill web-design-guidelines).

---

## Indice documentazione

Indice completo e aggiornato: [`docs/README.md`](docs/README.md). Voci principali:

| File | Contenuto |
|------|-----------|
| [`CLAUDE.md`](../CLAUDE.md) | Guida per Claude Code: comandi, architettura, convenzioni (radice repo) |
| [`docs/AGENTS.md`](docs/AGENTS.md) | Regole per agenti e convenzioni codice |
| [`docs/architecture/stores.md`](docs/architecture/stores.md) | Store Pinia — 10 store (6 Supabase + 4 sessione), corretto il 2026-07-13 |
| [`docs/architecture/database.md`](docs/architecture/database.md) | RLS, trigger, stats denormalizzate |
| [`docs/architecture/event-flow.md`](docs/architecture/event-flow.md) | Lifecycle evento, mutazioni DB per fase |
| [`docs/architecture/state-flow.md`](docs/architecture/state-flow.md) | Flusso DB → store → composable → componente |
| [`docs/architecture/modal-url-sync.md`](docs/architecture/modal-url-sync.md) | Sync query ↔ modali evento |
| [`docs/architecture/routes.md`](docs/architecture/routes.md) | Inventario route, parametri nested |
| [`docs/architecture/component-hierarchy.md`](docs/architecture/component-hierarchy.md) | Albero componenti per pagina |
| [`docs/architecture/async-data-keys.md`](docs/architecture/async-data-keys.md) | Convenzione naming chiavi `useAsyncData` |
| [`docs/BACKLOG.md`](docs/BACKLOG.md) | Lavoro committed, ranked per priorità (P1–P3) con stima effort (S/M/L) |
| [`docs/TODO.md`](docs/TODO.md) | Osservazioni sparse, non ancora committed |
| [`docs/audits/2026-05-24-skills-audit-report.md`](docs/audits/2026-05-24-skills-audit-report.md) | Audit best practices |
| [`docs/audits/skills-audit-checklist.md`](docs/audits/skills-audit-checklist.md) | Checklist convenzioni |
| [`docs/audits/2026-07-12-vue-nuxt-conventions.md`](docs/audits/2026-07-12-vue-nuxt-conventions.md) | Audit Vue 3.5+/Nuxt 4 conventions |

---

## Changelog documento

| Data | Modifica |
|------|----------|
| 2026-07-20 | Audit TODO #8 risolto: le uccisioni (`round_results.number_of_kills`) andavano perse chiudendo la modale kill (Annulla/backdrop/ESC/X) senza passare da "Conferma" — la canvas mostrava già le uccisioni come "registrate" non appena disegnate, illudendo l'utente che fossero salvate. Deciso con l'utente: le uccisioni si salvano in un unico batch alla chiusura della modale (qualsiasi via), non più dietro un tasto "Conferma" esplicito — `KillSystemModal.vue` ora ha un `watch(open)` che emette `submit` a ogni transizione aperto→chiuso; footer semplificato a "Reset" + "Chiudi" (rimosso il pulsante Conferma, ora ridondante). Colto anche un secondo problema più profondo: `round_results.number_of_kills` era sempre stato solo un conteggio aggregato, senza tracciare *chi* ha ucciso *chi* — nuova tabella `round_kills` (pairing_id, killer_id, victim_id, `UNIQUE` sulla tripla, FK `pairing_id` `ON DELETE RESTRICT` come `round_results`) aggiunta con `supabase/migrations/20260720000000_create_round_kills.sql` e applicata in produzione; l'endpoint `kills.post.ts` ora sostituisce in blocco le righe di `round_kills` per il pairing e ricalcola `number_of_kills` per ogni giocatore come conteggio derivato (i trigger di stats restano invariati). `turn-back-round.post.ts` aggiornato per cancellare anche `round_kills` insieme a `round_results` prima di eliminare i pairing (stessa logica difensiva del fix BACKLOG #11) |
| 2026-07-20 | BACKLOG #11 risolto: `turn-back-round.post.ts` cancellava `pairings` prima di `round_results`, violando il vincolo `ON DELETE RESTRICT` introdotto dalla migration di questa sessione — 500 esattamente nel caso reale (round con punteggi già inseriti). Fix: cancella prima i `round_results` collegati, poi i `pairings`, in entrambi i rami (round>1 e round-1→registrazione). TDD: nuovo `test/e2e/turn-back-round.e2e.spec.ts` (primo spec solo-API, senza `page` — crea lega/evento/3 giocatori disposable, registra, avvia, sottomette punteggi reali, poi torna indietro), rosso confermato con l'esatto errore FK previsto dall'audit, poi verde dopo il fix |
| 2026-07-20 | BACKLOG #13 risolto: `useEventStore`'s `startEvent`/`nextRound`/`turnBackRound` ora rifiutano una seconda chiamata mentre una precedente è ancora in corso (guardia in-memory su `loading`, TDD — `test/unit/stores/events.test.ts` scritto per primo, rosso confermato, poi fix), più `:loading` cablato sulle due `ConfirmModal` (torna indietro/fine evento) che ne erano prive. Non sostituisce BACKLOG #12 (vincoli DB mancanti) — resta aperto per il caso di due tab/sessioni diverse o una retry diretta sull'API. |
| 2026-07-20 | Audit di fragilità del lifecycle evento (bug #11 `turn-back-round` 500 con punteggi già inseriti, regressione della migration RESTRICT della sessione precedente; #12 idempotenza mancante su advance-round/start/submission punteggi — nessun duplicato reale trovato in produzione, rischio latente non ancora manifestato) — tracciato in `docs/BACKLOG.md` #11-13, approccio TDD per ciascuno |
| 2026-07-20 | `/players` convertita da card grid a tabella (`PlayersTable.vue`): colonna di selezione (per future massive operations, non ancora cablate), sort nativo per colonna, tutti e 5 i campi DB esposti (`is_active`/`formats_played` prima mai mostrati). `CreatePlayerModal` estesa a modale di modifica completa. Backfill produzione: `is_active` allineato alla partecipazione eventi 2026 (35→45 corretti su 188 giocatori, prima disallineato per 50 righe) |
| 2026-07-13 | Eliminato `docs/bugs.md` (2 item): il bug sul timing dell'ottimizzazione nella preview tavoli risultava già risolto nel codice attuale (`TablePreviewModal.vue` auto-ottimizza all'apertura, coerente con l'entry di changelog 2026-05-26 "Preview mostra tavoli prima di avanzare round") — non riportato; la richiesta di redesign layout `TableCard.vue` (icona in alto a sinistra superflua, da progettare in vista dell'inserimento futuro di comandante/voti lato giocatore) era invece azionabile — spostata in `docs/BACKLOG.md` come item #2 (P1) |
| 2026-07-13 | Riorganizzati i doc "come funziona l'app" (`stores`, `database`, `event-flow`, `state-flow`, `modal-url-sync`, `routes`, `component-hierarchy`, `async-data-keys`) sotto `docs/architecture/`, separati dai doc di ingresso (`README.md`, `AGENTS.md`, `TODO.md`, `BACKLOG.md`, `PROGRESS.md`, `bugs.md`) rimasti alla radice di `docs/`. Aggiornati tutti i link incrociati (root `CLAUDE.md`, `app/stores/CLAUDE.md`, `app/composables/CLAUDE.md`, `docs/AGENTS.md`, cross-link interni tra i file spostati) e aggiunta una sezione "Documentation" al `README.md` di root con link a `docs/README.md` |
| 2026-07-13 | Creato `docs/BACKLOG.md`: lavoro committed/ranked (priorità P1–P3, stima S/M/L), separato da `docs/TODO.md` (ora solo osservazioni sparse non committed). Spostati i 4 item azionabili (Playwright+MCP, alarm sound timer, Valibot `isValid` nei form, DnD nativo in `TableScoreGrid.vue`) da `TODO.md` a `BACKLOG.md`. Aggiornata la sezione "Documentation" di `CLAUDE.md` (radice repo) per riflettere la tripartizione TODO/BACKLOG/PROGRESS |
| 2026-07-13 | Audit `docs/` completo: `docs/stores.md` corretto (8→10 store, mancavano `useCommanderDeckStore`/`usePlayerStatsStore`); `docs/README.md` indice/albero file aggiornati (mancavano `PROGRESS.md`, `prompts/`, struttura reale `superpowers/plans+specs/`); eliminati `docs/buttons.md` (chat di design superata, vedi `RowActionButton.vue`/`actionButton.ts`), `docs/prompts/decompose-players-page*.md` (piano già implementato in `app/components/player/`), `docs/reinventing-the-wheel.md` + `docs/prompt-for-ai.md` (9/11 findings fatti o superati dalla migrazione Scryfall→Supabase; i 2 ancora aperti — Valibot `isValid` nei form modal, DnD nativo in `TableScoreGrid.vue` — spostati in `docs/TODO.md`) |
| 2026-07-13 | Sessione duplicazione + tuning `fallow` (ADR-011): `fallow:dupes` da 128 gruppi (17.6%) a 0; `app/components/ui/` riorganizzato in `actions/`, `modal/`, `layout/`, `display/`, `input/`; `BaseButton`/`ActionButtons` rinominati `RowActionButton`/`RowActionButtons`; nuovo `ConfirmButton` gemello di `CancelButton`; `duplicates.mode` assestato su `weak`; `health.thresholdOverrides` per 10 file grandi ma intenzionali; scoperto gotcha glob su cartelle `[param]` (fix: wildcard `?`); `leagues.status` rinominato da italiano a codici inglesi minuscoli (migrazione dati DB da fare manualmente); test da 19/6 file a 61/10 file; `docs/TODO.md` ripulito da contenuto implementato/debris |
| 2026-07-12 | Sessione lint/typecheck/architettura: `pnpm lint` e `pnpm typecheck` portati a 0/0 (ADR-009); aggiunta `event_round_duration` (migrazione + wiring, non ancora applicata — ADR-008); documentato invariante scoring pairing optimizer (ADR-004); rimossa cartella shim `app/composables/events/` (progetto non pubblicato → niente backward-compat); creato `CLAUDE.md`; TODO Playwright + MCP aggiunto; corrette informazioni datate (store count 8→10, claim falso sul rename `[id]`→`[leagueId]`, valibot "0 uso"); scoperto `pnpm build` rotto (prerender `/`, non correlato a questa sessione) |
| 2026-05-26 | Preview mostra tavoli prima di avanzare round (non dopo); `playerOrder` propagato a `nextRound` → `createPairings`; URL `phase=previewTables` ora include `round=N`; `previewTables` usa standings durante playing |
| 2026-05-26 | Documentazione completa dei 6 URL query params in `docs/architecture/modal-url-sync.md` |
| 2026-05-25 | Uniformato il parametro di routing da [id] a [leagueId] per l'evento annidato — **nota (2026-07-20)**: `league/[id].vue` (pagina lega, non annidata) usa comunque `route.params.id`, per necessità strutturale di Nuxt (route annidate non possono avere due segmenti con lo stesso nome parametro), non per un'incoerenza da correggere |
| 2026-05-25 | Aggiornamento `docs/architecture/stores.md`: documentazione 8 store (4 Supabase + 4 sessione) e migrazione Setup API |
| 2026-05-25 | Creazione iniziale `PROGRESS.md` dopo audit skill e batch convenzioni |
