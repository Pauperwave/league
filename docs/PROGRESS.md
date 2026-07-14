# PROGRESS — MTG League Manager

Documento vivo per tracciare avanzamento, architettura e decisioni. Aggiornare quando cambiano scope, stack o convenzioni rilevanti.

**Ultimo aggiornamento:** 2026-07-13

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

**⚠️ Inconsistenza nota (trovata 2026-07-12):** il parametro lega **non** è uniformato come indicato in precedenza — `app/pages/league/[id].vue` usa ancora `route.params.id`, mentre la route annidata evento usa `[leagueId]`. Non rinominato in questa sessione (cambia gli URL pubblici); da decidere se e quando allinearli.

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
- Dettaglio operativo completo (vincoli serverless, piano a slice, gotcha SSR): `docs/BACKLOG.md` #7.

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
| Validazione form (valibot) | 🟡 Parziale | In uso in `EventFormModal` e altri (5 file); non su tutti i form |
| Test e2e Playwright | ☐ Non iniziato | Richiesto in `AGENTS.md`; TODO aggiunto in `docs/TODO.md` (Playwright + Playwright MCP) |
| Test unitari | 🟡 Parziale | 61 test / 10 file (`pairingOptimizer`, `useTableDnd`, `usePlayersFilter`, `useLiveStandings`, `cardColors`, `RowActionButton`, `StandingsCard`, …) |

---

## Qualità e tooling (2026-07-12)

| Comando | Stato |
|---------|--------|
| `pnpm lint` | ✅ 0 warning, 0 errori (vedi ADR-009) |
| `pnpm typecheck` | ✅ 0 errori — corretti due bug pre-esistenti non legati a questa sessione: mismatch di casing su `~/components/ui/*` (cartella reale `Ui/`) e alias `#test` mancante in `nuxt.config.ts` (risolveva solo lato vitest, non lato `nuxt typecheck`) |
| `pnpm test` | ✅ 61 test / 10 file |
| `pnpm fallow:dupes` | ✅ 0 clone groups (era 128 gruppi / 17.6% al 2026-07-13 mattina — vedi ADR-011) |
| `pnpm build` | ❌ **Rotto** — fallisce in prerender di `/` (`routeRules: { '/': { prerender: true } }`): `SyntaxError: The requested module 'vue/index.mjs' does not provide an export named 'default'` (ESM/CJS interop in Nitro). Non causato da questa sessione (nessuna modifica a Vue, `/`, o config di prerender) — probabile drift di dipendenze (Renovate). Da investigare. |

### Convenzioni codice — batch completati (2026-05-25)

- [x] Path comment su tutti i `.vue`
- [x] `defineProps` inline (nessun `interface Props`)
- [x] Migrazione `withDefaults` → destructuring (8 file)
- [x] Store Pinia uniformati a Setup API (4 store sessione migrati)
- [x] Typecheck: `@tanstack/vue-table` devDep + tipi Scryfall in `useCardWhitelists`
- [ ] ~~Uniformato parametro route per lega a `[leagueId]`~~ — **non verificato, in realtà regredito**: `app/pages/league/[id].vue` usa ancora `route.params.id` (vedi nota nella sezione Route sopra)

### Batch completati (2026-07-12)

- [x] Rimossi tutti gli `any` residui da lint (`useCommanderCards`, `useCommanderSearch`, `usePlayerMatchHistory`, `usePairingsQuery`, `useStatsQueryBuilder`, `stores/events.ts`) con tipi reali da `#shared/utils/types`
- [x] Aggiunta colonna `event_round_duration` (migrazione + wiring form→store→DB, non ancora applicata al DB reale — ADR-008)
- [x] Documentato l'invariante di scoring del pairing optimizer (ADR-004)
- [x] Rimossa cartella shim `app/composables/events/` (re-export verso `event-pairing/`, non necessaria: progetto non pubblicato)
- [x] Creato `CLAUDE.md` alla radice del repo
- [x] Aggiunto TODO per Playwright + Playwright MCP in `docs/TODO.md`

Audit dettagliato: [`docs/audits/skills-audit-report.md`](docs/audits/skills-audit-report.md), checklist: [`docs/audits/skills-audit-checklist.md`](docs/audits/skills-audit-checklist.md) — **non riverificati in questa sessione**, possono essere datati. Vedi anche [`docs/audits/2026-07-12-vue-nuxt-conventions.md`](docs/audits/2026-07-12-vue-nuxt-conventions.md) per l'audit Vue 3.5+/Nuxt 4.

---

## Prossimi passi (priorità)

### Alta

0. **`pnpm build` è rotto** — fallisce in prerender di `/` con un errore ESM/CJS su `vue/index.mjs` (vedi tabella Qualità e tooling sopra). CI attuale non lo cattura (`ci.yml` gira solo lint + typecheck, non build). Non correlato a questa sessione.
1. **Applicare la migrazione `event_round_duration`** al DB reale (`supabase db push` o dashboard) e rigenerare `shared/utils/types/database.ts` per davvero (`npx supabase gen types ...`) — vedi ADR-008.
2. **Rimuovere o centralizzare `console.log` di debug** (`[eventId].vue`, `useEventUrl`, `useCardWhitelists`, …) → usare `app/utils/logger.ts` dove serve.
3. **Decidere sul parametro route `[id]` vs `[leagueId]`** su `league/[id].vue` — inconsistenza trovata il 2026-07-12, non ancora risolta (cambia URL pubblici, richiede decisione esplicita).

### Media

4. **Refactor pagina evento** — `[eventId].vue` e alcuni SFC restano > 250 righe (`TablePreviewModal`, `PairingsCard`, `TableScoreGrid`, `RoundTimer`, `useEventStore`, `useEventPage`, `useTableDnd`). Deciso il 2026-07-13 (ADR-011) di **non** spezzarli forzatamente: sono stati dati ceiling espliciti via `health.thresholdOverrides` in `.fallowrc.json`, restando tracciati se crescono oltre. Riconsiderare uno split reale solo se uno di questi supera il proprio ceiling o diventa davvero difficile da seguire, non per inseguire il punteggio `fallow health`.
5. **Validazione con valibot** — estendere agli altri form modali oltre a `EventFormModal` (lega, ruleset, player).

### Bassa

6. **Test Vitest** — store sessione, `useEventUrl`, composables Supabase critici.
7. **E2E Playwright** — vedi `docs/TODO.md` (setup `@playwright/test` + Playwright MCP, poi: login, crea lega, apri evento, modale punteggi con query).
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
| [`docs/audits/skills-audit-report.md`](docs/audits/skills-audit-report.md) | Audit best practices |
| [`docs/audits/skills-audit-checklist.md`](docs/audits/skills-audit-checklist.md) | Checklist convenzioni |
| [`docs/audits/2026-07-12-vue-nuxt-conventions.md`](docs/audits/2026-07-12-vue-nuxt-conventions.md) | Audit Vue 3.5+/Nuxt 4 conventions |

---

## Changelog documento

| Data | Modifica |
|------|----------|
| 2026-07-13 | Eliminato `docs/bugs.md` (2 item): il bug sul timing dell'ottimizzazione nella preview tavoli risultava già risolto nel codice attuale (`TablePreviewModal.vue` auto-ottimizza all'apertura, coerente con l'entry di changelog 2026-05-26 "Preview mostra tavoli prima di avanzare round") — non riportato; la richiesta di redesign layout `TableCard.vue` (icona in alto a sinistra superflua, da progettare in vista dell'inserimento futuro di comandante/voti lato giocatore) era invece azionabile — spostata in `docs/BACKLOG.md` come item #2 (P1) |
| 2026-07-13 | Riorganizzati i doc "come funziona l'app" (`stores`, `database`, `event-flow`, `state-flow`, `modal-url-sync`, `routes`, `component-hierarchy`, `async-data-keys`) sotto `docs/architecture/`, separati dai doc di ingresso (`README.md`, `AGENTS.md`, `TODO.md`, `BACKLOG.md`, `PROGRESS.md`, `bugs.md`) rimasti alla radice di `docs/`. Aggiornati tutti i link incrociati (root `CLAUDE.md`, `app/stores/CLAUDE.md`, `app/composables/CLAUDE.md`, `docs/AGENTS.md`, cross-link interni tra i file spostati) e aggiunta una sezione "Documentation" al `README.md` di root con link a `docs/README.md` |
| 2026-07-13 | Creato `docs/BACKLOG.md`: lavoro committed/ranked (priorità P1–P3, stima S/M/L), separato da `docs/TODO.md` (ora solo osservazioni sparse non committed). Spostati i 4 item azionabili (Playwright+MCP, alarm sound timer, Valibot `isValid` nei form, DnD nativo in `TableScoreGrid.vue`) da `TODO.md` a `BACKLOG.md`. Aggiornata la sezione "Documentation" di `CLAUDE.md` (radice repo) per riflettere la tripartizione TODO/BACKLOG/PROGRESS |
| 2026-07-13 | Audit `docs/` completo: `docs/stores.md` corretto (8→10 store, mancavano `useCommanderDeckStore`/`usePlayerStatsStore`); `docs/README.md` indice/albero file aggiornati (mancavano `PROGRESS.md`, `prompts/`, struttura reale `superpowers/plans+specs/`); eliminati `docs/buttons.md` (chat di design superata, vedi `RowActionButton.vue`/`actionButton.ts`), `docs/prompts/decompose-players-page*.md` (piano già implementato in `app/components/player/`), `docs/reinventing-the-wheel.md` + `docs/prompt-for-ai.md` (9/11 findings fatti o superati dalla migrazione Scryfall→Supabase; i 2 ancora aperti — Valibot `isValid` nei form modal, DnD nativo in `TableScoreGrid.vue` — spostati in `docs/TODO.md`) |
| 2026-07-13 | Sessione duplicazione + tuning `fallow` (ADR-011): `fallow:dupes` da 128 gruppi (17.6%) a 0; `app/components/ui/` riorganizzato in `actions/`, `modal/`, `layout/`, `display/`, `input/`; `BaseButton`/`ActionButtons` rinominati `RowActionButton`/`RowActionButtons`; nuovo `ConfirmButton` gemello di `CancelButton`; `duplicates.mode` assestato su `weak`; `health.thresholdOverrides` per 10 file grandi ma intenzionali; scoperto gotcha glob su cartelle `[param]` (fix: wildcard `?`); `leagues.status` rinominato da italiano a codici inglesi minuscoli (migrazione dati DB da fare manualmente); test da 19/6 file a 61/10 file; `docs/TODO.md` ripulito da contenuto implementato/debris |
| 2026-07-12 | Sessione lint/typecheck/architettura: `pnpm lint` e `pnpm typecheck` portati a 0/0 (ADR-009); aggiunta `event_round_duration` (migrazione + wiring, non ancora applicata — ADR-008); documentato invariante scoring pairing optimizer (ADR-004); rimossa cartella shim `app/composables/events/` (progetto non pubblicato → niente backward-compat); creato `CLAUDE.md`; TODO Playwright + MCP aggiunto; corrette informazioni datate (store count 8→10, claim falso sul rename `[id]`→`[leagueId]`, valibot "0 uso"); scoperto `pnpm build` rotto (prerender `/`, non correlato a questa sessione) |
| 2026-05-26 | Preview mostra tavoli prima di avanzare round (non dopo); `playerOrder` propagato a `nextRound` → `createPairings`; URL `phase=previewTables` ora include `round=N`; `previewTables` usa standings durante playing |
| 2026-05-26 | Documentazione completa dei 6 URL query params in `docs/architecture/modal-url-sync.md` |
| 2026-05-25 | Uniformato il parametro di routing da [id] a [leagueId] per consistenza — **⚠️ non risulta più vero al 2026-07-12**, `league/[id].vue` esiste ancora con `route.params.id` |
| 2026-05-25 | Aggiornamento `docs/architecture/stores.md`: documentazione 8 store (4 Supabase + 4 sessione) e migrazione Setup API |
| 2026-05-25 | Creazione iniziale `PROGRESS.md` dopo audit skill e batch convenzioni |
