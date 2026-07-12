# PROGRESS — MTG League Manager

Documento vivo per tracciare avanzamento, architettura e decisioni. Aggiornare quando cambiano scope, stack o convenzioni rilevanti.

**Ultimo aggiornamento:** 2026-07-12

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

Dettaglio completo: [`docs/stores.md`](docs/stores.md) (documentazione parziale, verificare contro `app/stores/` — vedi nota sotto).

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
- **Doc:** [`docs/modal-url-sync.md`](docs/modal-url-sync.md)

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
- **Doc:** flusso documentato in `docs/stores.md`.

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
  - I valori persistiti su DB che sono testo italiano leggibile (es. `leagues.status`) restano stringhe letterali — sono dati, non copy UI.
- **Test infra:** `test/helpers/mocks.ts` esporta `createI18nTestPlugin(messages)` per montare componenti che usano `useI18n()` in `test/nuxt/**` (plain `@vue/test-utils` `mount()` non applica il plugin reale di Nuxt).
- **Stato:** ✅ completo — verificato con `pnpm lint`/`pnpm typecheck`/`pnpm test`/`pnpm fallow:dead-code` a zero problemi dopo ogni dominio migrato (league, ruleset, player, deck/commander, event — pagina/control-panel/waiting-list/modali/pairing-kill-table/standings —, store, login/home/misc).

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
| Test unitari | 🟡 Parziale | 19 test / 6 file (`pairingOptimizer`, `BaseButton`, `StandingsCard`, …) |

---

## Qualità e tooling (2026-07-12)

| Comando | Stato |
|---------|--------|
| `pnpm lint` | ✅ 0 warning, 0 errori (vedi ADR-009) |
| `pnpm typecheck` | ✅ 0 errori — corretti due bug pre-esistenti non legati a questa sessione: mismatch di casing su `~/components/ui/*` (cartella reale `Ui/`) e alias `#test` mancante in `nuxt.config.ts` (risolveva solo lato vitest, non lato `nuxt typecheck`) |
| `pnpm test` | ✅ 19 test / 6 file |
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

4. **Refactor pagina evento** — spezzare `[eventId].vue` e SFC > 250 righe (`TablePreviewModal`, `TableScoreGrid`).
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
| [`docs/stores.md`](docs/stores.md) | Store Pinia — **verificare contro `app/stores/` (10 store attuali, non 8)** |
| [`docs/database.md`](docs/database.md) | RLS, trigger, stats denormalizzate |
| [`docs/event-flow.md`](docs/event-flow.md) | Lifecycle evento, mutazioni DB per fase |
| [`docs/state-flow.md`](docs/state-flow.md) | Flusso DB → store → composable → componente |
| [`docs/modal-url-sync.md`](docs/modal-url-sync.md) | Sync query ↔ modali evento |
| [`docs/buttons.md`](docs/buttons.md) | Pattern bottoni / logging |
| [`docs/TODO.md`](docs/TODO.md) | Idee e snippet storici, incl. Playwright + MCP |
| [`docs/audits/skills-audit-report.md`](docs/audits/skills-audit-report.md) | Audit best practices |
| [`docs/audits/skills-audit-checklist.md`](docs/audits/skills-audit-checklist.md) | Checklist convenzioni |
| [`docs/audits/2026-07-12-vue-nuxt-conventions.md`](docs/audits/2026-07-12-vue-nuxt-conventions.md) | Audit Vue 3.5+/Nuxt 4 conventions |

---

## Changelog documento

| Data | Modifica |
|------|----------|
| 2026-07-12 | Sessione lint/typecheck/architettura: `pnpm lint` e `pnpm typecheck` portati a 0/0 (ADR-009); aggiunta `event_round_duration` (migrazione + wiring, non ancora applicata — ADR-008); documentato invariante scoring pairing optimizer (ADR-004); rimossa cartella shim `app/composables/events/` (progetto non pubblicato → niente backward-compat); creato `CLAUDE.md`; TODO Playwright + MCP aggiunto; corrette informazioni datate (store count 8→10, claim falso sul rename `[id]`→`[leagueId]`, valibot "0 uso"); scoperto `pnpm build` rotto (prerender `/`, non correlato a questa sessione) |
| 2026-05-26 | Preview mostra tavoli prima di avanzare round (non dopo); `playerOrder` propagato a `nextRound` → `createPairings`; URL `phase=previewTables` ora include `round=N`; `previewTables` usa standings durante playing |
| 2026-05-26 | Documentazione completa dei 6 URL query params in `docs/modal-url-sync.md` |
| 2026-05-25 | Uniformato il parametro di routing da [id] a [leagueId] per consistenza — **⚠️ non risulta più vero al 2026-07-12**, `league/[id].vue` esiste ancora con `route.params.id` |
| 2026-05-25 | Aggiornamento `docs/stores.md`: documentazione 8 store (4 Supabase + 4 sessione) e migrazione Setup API |
| 2026-05-25 | Creazione iniziale `PROGRESS.md` dopo audit skill e batch convenzioni |
