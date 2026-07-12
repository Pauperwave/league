# PROGRESS — MTG League Manager

Documento vivo per tracciare avanzamento, architettura e decisioni. Aggiornare quando cambiano scope, stack o convenzioni rilevanti.

**Ultimo aggiornamento:** 2026-05-26

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
├── components/         # UI per feature (events, modals, tables, …)
├── composables/        # Logica riutilizzabile
│   ├── supabase/       # Fetch SSR + delega agli store persistenti
│   ├── event/          # Pagina evento, URL sync, preset pairing
│   ├── events/pairing/ # Optimizer abbinamenti + test
│   └── tables/         # Preview tavoli, DnD, calcolo punteggi
├── stores/             # Pinia: Supabase + stato sessione evento
├── middleware/         # Protezione password
├── plugins/            # Route logger
└── assets/css/         # Stili globali

shared/utils/types/     # Tipi DB e dominio condivisi
docs/                   # Documentazione feature e convenzioni
```

### Pattern dati

1. **Store Pinia** = fonte di verità per entità Supabase e stato UI di sessione (rankings, kills, votes, commanders).
2. **Composables `use*`** = orchestrazione pagina, `useAsyncData`, helper puri.
3. **Pagine** = composizione componenti; la pagina evento è la più complessa (`useEventPage` + `useEventUrl`).

Dettaglio completo: [`docs/stores.md`](docs/stores.md) (8 store documentati con Setup API).

---

## Route principali

| Route | Scopo |
|-------|--------|
| `/` | Home |
| `/login` | Auth password + redirect query |
| `/leagues` | CRUD leghe |
| `/rulesets` | Gestione ruleset |
| `/league/[leagueId]` | Eventi di una lega |
| `/league/[leagueId]/event/[eventId]` | Hub evento (registrazione → playing → ended) |

**Nota tecnica:** parametro lega uniformato a `leagueId` su tutte le route (risolto il 2026-05-25).


---

## Store Pinia (8)

| Store | Tipo stato | Ruolo |
|-------|------------|--------|
| `useLeagueStore` | Supabase | Leghe |
| `useRulesetStore` | Supabase | Ruleset punteggio |
| `usePlayerStore` | Supabase | Giocatori + waiting list |
| `useEventStore` | Supabase | Eventi, standings, pairings, round, round_results |
| `useRankingsStore` | Sessione + DB | Ordine classifica salvato su `round_results.position` via `savePairingRankings` |
| `useKillsStore` | Sessione + DB | Kill nel round, persistiti su `round_results.number_of_kills` via `savePairingKills` |
| `useVotesStore` | Sessione + DB | Voti deck/play, persistiti su `round_results.brew_vote/play_vote_1` via `saveVote` |
| `useCommandersStore` | Sessione + DB | Commander per giocatore, persistiti su `round_results.commander_1` via `saveCommander` |

Tutti gli store usano **Setup API** (`defineStore('id', () => { … })`) dal 2026-05-25.
Gli store di sessione ora hanno **persistenza ottimistica**: update immediato UI + salvataggio asincrono su `round_results` via `useEventStore` + toast di esito.

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

- **Decisione:** algoritmo in `pairingOptimizer.ts` con pesi/preferenze salvate per evento.
- **Motivo:** preview tavoli interattiva (DnD + ottimizzazione) senza round-trip server per ogni tentativo.
- **Test:** `pairingOptimizer.test.ts` (6 test Vitest).

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
- **Follow-up:** spostare password in variabile d’ambiente (non hardcoded in `nuxt.config.ts`).

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
| Round timer | ✅ Presente | `RoundTimer.vue` |
| Validazione form (valibot) | ☐ Non iniziato | Dipendenza presente, 0 uso |
| Test e2e Playwright | ☐ Non iniziato | Richiesto in `AGENTS.md` |
| Test unitari estesi | 🟡 Parziale | Solo `pairingOptimizer` |

---

## Qualità e tooling (2026-05-25)

| Comando | Stato |
|---------|--------|
| `pnpm lint` | ✅ 0 errori (9 warning secondari di tipo o eslint-disable in logger/canvas) |
| `pnpm typecheck` | ✅ |
| `pnpm test` | ✅ 6 test |
| `pnpm build` | ✅ Operativo (compilazione Client/Server/Nitro e prerendering di / con successo) |

### Convenzioni codice — batch completati (2026-05-25)

- [x] Path comment su tutti i `.vue`
- [x] `defineProps` inline (nessun `interface Props`)
- [x] Migrazione `withDefaults` → destructuring (8 file)
- [x] Store Pinia uniformati a Setup API (4 store sessione migrati)
- [x] Typecheck: `@tanstack/vue-table` devDep + tipi Scryfall in `useCardWhitelists`
- [x] Uniformato parametro route per lega a [leagueId] (rinominato [id].vue → [leagueId].vue e risolto inconsistenze)


Audit dettagliato: [`docs/skills-audit-report.md`](docs/skills-audit-report.md), checklist: [`docs/skills-audit-checklist.md`](docs/skills-audit-checklist.md).

---

## Prossimi passi (priorità)

### Alta

1. **Rimuovere o centralizzare `console.log` di debug** (`[eventId].vue`, `useEventUrl`, `useCardWhitelists`, …) → usare `app/utils/logger.ts` dove serve.
2. **`sitePassword` da env** (`NUXT_SITE_PASSWORD` o equivalente), non valore in chiaro in repo.

### Media

3. **Refactor pagina evento** — spezzare `[eventId].vue` e SFC > 250 righe (`TablePreviewModal`, `TableScoreGrid`).
4. **Validazione con valibot** su form modali (lega, evento, ruleset, player).

### Bassa

7. **Test Vitest** — store sessione, `useEventUrl`, composables Supabase critici.
8. **E2E Playwright** — login, crea lega, apri evento, modale punteggi con query.
9. **Estendere URL sync** alle modali su `/leagues` (opzionale).
10. **Accessibilità** — review sistematica modali/tabelle (skill web-design-guidelines).

---

## Indice documentazione

| File | Contenuto |
|------|-----------|
| [`docs/AGENTS.md`](docs/AGENTS.md) | Regole per agenti e convenzioni codice |
| [`docs/stores.md`](docs/stores.md) | Store Pinia (8 store, Setup API) |
| [`docs/modal-url-sync.md`](docs/modal-url-sync.md) | Sync query ↔ modali evento |
| [`docs/buttons.md`](docs/buttons.md) | Pattern bottoni / logging |
| [`docs/TODO.md`](docs/TODO.md) | Idee e snippet storici |
| [`docs/skills-audit-report.md`](docs/skills-audit-report.md) | Audit best practices |
| [`docs/skills-audit-checklist.md`](docs/skills-audit-checklist.md) | Checklist convenzioni |

---

## Changelog documento

| Data | Modifica |
|------|----------|
| 2026-05-26 | Preview mostra tavoli prima di avanzare round (non dopo); `playerOrder` propagato a `nextRound` → `createPairings`; URL `phase=previewTables` ora include `round=N`; `previewTables` usa standings durante playing |
| 2026-05-26 | Documentazione completa dei 6 URL query params in `docs/modal-url-sync.md` |
| 2026-05-25 | Uniformato il parametro di routing da [id] a [leagueId] per consistenza |
| 2026-05-25 | Aggiornamento `docs/stores.md`: documentazione 8 store (4 Supabase + 4 sessione) e migrazione Setup API |
| 2026-05-25 | Creazione iniziale `PROGRESS.md` dopo audit skill e batch convenzioni |
