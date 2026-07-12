# Audit best practices (skill installate)

Report generato il 2026-05-24 incrociando le **12 skill installate** con `pnpm lint`, `pnpm typecheck`, `pnpm test` e campionamento del codice. Non è una review riga per riga di tutti i file, ma una valutazione sistematica su ciò che le skill enfatizzano.

---

## Verdetto generale

Il progetto è **ben allineato** allo stack (Nuxt 4 + Composition API + Pinia + pnpm + Vitest). Le aree più deboli sono **typecheck**, **copertura test**, **coerenza delle convenzioni interne** (`docs/AGENTS.md`) e **alcune pagine/componenti troppo grandi**.

| Area | Giudizio |
|------|----------|
| Architettura Nuxt/Vue | Buono |
| Pinia | Buono, ma stili misti |
| Vue Router / query sync | Buono |
| TypeScript / lint | Lint ok, typecheck fallisce |
| Test | Minimo ma funzionante |
| UI / accessibilità | Parziale |
| Convenzioni progetto | Gap rispetto ad `AGENTS.md` |

---

## Per skill

### `nuxt` — **Buono (8/10)**

**In linea:**

- Struttura Nuxt 4 con `app/` come source
- Moduli appropriati (`@nuxt/ui`, `@pinia/nuxt`, `@vueuse/nuxt`, Supabase)
- Auto-import composables da `~/composables/**`
- `useAsyncData` in parallelo sulla pagina evento
- `routeRules` con prerender su `/`

**Da migliorare:**

- Parametri route incoerenti: `league/[id].vue` vs `league/[leagueId]/event/[eventId].vue`
- `runtimeConfig.sitePassword` hardcoded in `nuxt.config.ts` (meglio variabile d’ambiente)
- Pagina evento molto orchestratrice (~650 righe): la skill Nuxt preferisce pagine “sottili” + composables

---

### `vue` + `vue-best-practices` — **Buono (7.5/10)**

**In linea:**

- Tutti i `.vue` usano `<script setup lang="ts">` (nessuna Options API nei componenti)
- Stato locale con `ref`/`computed`, logica estratta in composables (`useEventPage`, `useLeagues`, …)
- Tipi da `#shared/utils/types`

**Da migliorare:**

- ~~Molti componenti usano `interface Props` separata~~ — risolto (2026-05-25): tutti inline; ~~8 file con `withDefaults`~~ — migrati a destructuring Vue 3.4+
- Commento path `<!-- app\... -->` solo su ~35/61 file Vue
- `console.log` di debug sparsi (es. `[eventId].vue`, `useEventUrl.ts`, `useCardWhitelists.ts`) — da rimuovere o passare a `logger`
- SFC grandi: `TablePreviewModal` (~279 righe), `TableScoreGrid` (~276), pagina evento ancora più grande

---

### `pinia` — **Buono con incoerenze (7/10)**

**In linea:**

- Store setup ben strutturati (`leagues`, `events`, `players`, `rulesets`): stato minimo, `computed` per derivati, azioni async con gestione errori
- Pattern `{ success, error }` nelle mutazioni

**Da migliorare:**

- **4 store in Options API** (`rankings`, `kills`, `votes`, `commanders`) vs **4 in Setup API** — funziona, ma Pinia/modern Vue preferiscono uno stile uniforme
- Nessun uso visibile di `storeToRefs` quando si destrutturano store nei componenti (rischio perdita reattività se si espande)
- Store usati direttamente nella pagina evento (5 store + composable): candidato a composable unificato

---

### `vue-router-best-practices` — **Buono (8/10)**

**In linea:**

- Sync bidirezionale URL ↔ modale documentato e implementato (`useEventUrl`, `router.replace`)
- Preservazione query esistenti (`phase`, `round`, `scoreModal`)
- Guardie sui watcher (`!showScoreModal.value` prima di riaprire da URL)
- Login con `?redirect=` e `navigateTo` dopo auth

**Da migliorare:**

- Validazione query debole: `route.query.redirect as string`, `Number(pairingId)` senza check su `NaN`/ID inesistente
- `watch(phaseFromQuery)` apre preview ma non gestisce esplicitamente la chiusura da URL
- Debug `console.log` nel flusso router (rumore e rischio loop in fase di refactor)

---

### `pnpm` — **Ottimo (9/10)**

- `packageManager: pnpm@10.33.0` bloccato
- `pnpm-lock.yaml` presente
- Script chiari: `dev`, `build`, `lint`, `typecheck`, `test`

Nessun problema rilevante.

---

### `vite` — **Ok (8/10)**

Config in `nuxt.config.ts` ragionevole (`sourcemap: false`, `optimizeDeps` per `@internationalized/date`). Uso corretto come layer sotto Nuxt, non configurazione standalone.

---

### `vitest` + `vue-testing-best-practices` — **Debole (4/10)**

**In linea:**

- `pnpm test` passa: **6 test** su `pairingOptimizer` (logica core ben testata)

**Gap rispetto alle skill e ad `AGENTS.md`:**

- **1 solo file di test** su tutta l’app
- Nessun test componenti/composables Supabase
- Nessun test Pinia (`@pinia/testing`)
- Nessun e2e Playwright (richiesto in `AGENTS.md`, assente)

---

### `vueuse-functions` — **Sottoutilizzato, non errato (6/10)**

Dipendenze presenti, uso reale minimo (`useDebounceFn` in `useCardSearch.ts`). Non è un problema: la skill suggerisce VueUse dove serve; non obbliga ad usarlo ovunque. Opportunità future: `useStorage`, `useUrlSearchParams` (parte già coperta dal router custom).

---

### `web-design-guidelines` + `@nuxt/a11y` — **Parziale (6/10)**

**In linea:**

- `@nuxt/ui` e `@nuxt/a11y` installati
- Alcuni attributi `aria-*` (login, tabelle, `BaseButton`, ecc.)

**Da migliorare:**

- Accessibilità non sistematica su modali/tabelle complesse (pairings, kill flow, canvas)
- Modali su `leagues.vue` senza deep link URL (UX condivisibile limitata rispetto al pattern evento)
- Review formale UX (skill web-design) non ancora fatta sui flussi critici

---

### `antfu` — **Misto (6.5/10)**

**In linea:**

- TypeScript strict-ish, tipi condivisi in `shared/`
- Composables per logica estratta
- ESLint con `@nuxt/eslint`

**Gap:**

- Nessun `PROGRESS.md` (richiesto in `AGENTS.md`)
- Funzioni > 50 righe in molti file (violazione convenzione progetto)
- `any` in `logger.ts` e `KillFlowCanvas.vue` (7 warning ESLint)
- `valibot` in `devDependencies` ma **0 utilizzi** nel codice app

---

## Problemi bloccanti (tooling)

`pnpm lint` — **0 errori**, 7 warning (`any`, eslint-disable inutili).

`pnpm typecheck` — **ok** (risolto 2026-05-25):

1. `@tanstack/vue-table@8.21.3` aggiunto in `devDependencies` per i tipi usati in `TableScoresModal.vue`
2. `useCardWhitelists.ts`: risposta Scryfall tipizzata con `ScryfallListResponse`

---

## Priorità consigliate

| Priorità | Azione |
|----------|--------|
| ~~Alta~~ | ~~Far passare `pnpm typecheck`~~ — completato 2026-05-25 |
| Alta | Rimuovere o centralizzare `console.log` di debug in produzione |
| Media | Uniformare store Pinia (tutti setup o documentare perché Options) |
| Media | Spezzare `[eventId].vue` e SFC > 250 righe |
| ~~Media~~ | ~~Migrare `withDefaults` → destructuring~~ — completato 2026-05-25 |
| ~~Media~~ | ~~Allineare `defineProps` inline + commenti path~~ — completato 2026-05-25 |
| Media | Introdurre validazione con **valibot** (come da `AGENTS.md`) |
| Bassa | Estendere test (composables critici, store, 1–2 flussi e2e) |
| Bassa | Valutare più VueUse dove riduce codice custom |

---

## Conclusione

Il progetto **segue le best practice principali** dello stack Vue/Nuxt/Pinia e implementa bene il **query sync** (skill router). Non è ancora “completo” rispetto a **testing**, **typecheck pulito**, **convenzioni `AGENTS.md`** e **uniformità Pinia/props**.

Checklist operativa per i gap medi (path comment, props inline, store Pinia): [`skills-audit-checklist.md`](./skills-audit-checklist.md).
