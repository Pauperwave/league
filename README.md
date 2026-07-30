# MTG Commander League

Web app Nuxt 4 per gestire leghe di **Magic: The Gathering Commander**: regolamenti, leghe, tornei, iscrizione in lista d'attesa, pairing, punteggio live e classifiche, con i flussi in-room (modali di punteggio, kill, comandante, voto).

Stack: Nuxt 4 · Vue 3.5 · Nuxt UI · Pinia / Pinia Colada · Supabase (Postgres + RLS) · TypeScript · Vitest · Playwright.

## Setup

```bash
pnpm install
```

Crea un `.env` con le variabili richieste dal progetto Supabase collegato (`SUPABASE_URL`, `SUPABASE_KEY`, `NUXT_SESSION_PASSWORD` — quest'ultima da almeno 32 caratteri, usata da `nuxt-auth-utils` per la sessione applicativa protetta da password).

## Sviluppo

```bash
pnpm dev            # dev server su http://localhost:3000
pnpm dev:clean       # come sopra, ripulendo prima .nuxt/.output/.vercel
```

## Build e produzione

```bash
pnpm build
pnpm preview        # preview locale della build di produzione
```

Vedi la [documentazione di deploy Nuxt](https://nuxt.com/docs/getting-started/deployment) per il deploy effettivo.

## Qualità del codice

```bash
pnpm lint           # eslint . — 0 warning/0 errori richiesti
pnpm typecheck      # nuxt typecheck (vue-tsc) — 0 errori richiesti
pnpm test           # vitest run (tutti i test)
pnpm test:e2e       # playwright
pnpm fallow:health  # audit di complessità/duplicazione/dead-code
```

## Supabase

Le migration vivono in `supabase/migrations/` (`YYYYMMDDHHMMSS_descrizione.sql`, idempotenti). Dopo ogni modifica allo schema, rigenera i tipi TypeScript:

```bash
npx supabase gen types typescript --project-id <project-id> --schema public > shared/utils/types/database.ts
```

`shared/utils/types/database.ts` è un file generato: non va editato a mano (eccezioni puntuali documentate in `docs/PROGRESS.md`).

## Renovate

La [Renovate GitHub app](https://github.com/apps/renovate/installations/select_target) è collegata a questa repo per il rinnovo automatico delle dipendenze.

## Documentazione

La documentazione di progetto vive in [`docs/`](docs/README.md) — parti da quell'indice. In particolare:

- [`docs/architecture/`](docs/architecture) — come funziona l'app: data flow (`state-flow.md`), routes, Pinia store, database/RLS, ciclo di vita dei tornei, gerarchia dei componenti, convenzioni delle chiavi `useAsyncData`, sync URL delle modali
- [`CLAUDE.md`](CLAUDE.md) — convenzioni e guida per agenti AI che lavorano su questa repo
- [`docs/BACKLOG.md`](docs/BACKLOG.md) — attività pianificate, ranked per priorità
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — changelog curato e decisioni architetturali (ADR)
