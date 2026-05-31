# Design: Aggiungere Testing al Progetto League

## 1. Configurazione & Dipendenze

Aggiornare il progetto per supportare **unit testing** e **Nuxt runtime testing** tramite Vitest multi-project.

### Dipendenze da aggiungere

| Pacchetto | Scope | Motivo |
|-----------|-------|--------|
| `@nuxt/test-utils` | `devDependencies` | Helper per test Nuxt (`mountSuspended`, `mockNuxtImport`, `registerEndpoint`) |
| `happy-dom` | `devDependencies` | DOM environment per test Nuxt (più veloce di jsdom) |
| `@vitest/coverage-v8` | `devDependencies` | Coverage report |

### Modifica `nuxt.config.ts`

Aggiungere `@nuxt/test-utils/module` alla lista dei moduli per abilitare il pannello Vitest nei Nuxt DevTools.

### Modifica `vitest.config.ts`

Sostituire la configurazione monolitica attuale con il pattern **multi-project**:

- **Progetto `unit`** (`test/unit/**/*.test.ts`)
  - `environment: 'node'`
  - Per logica pura, utilities, algoritmi, store helpers.
- **Progetto `nuxt`** (`test/nuxt/**/*.test.ts`)
  - `environment: 'nuxt'`
  - Per componenti Vue e composables che dipendono da auto-imports, `useRoute`, `useState`, etc.

I test non devono più essere cercati in `app/**/*.test.ts` per evitare conflitti con la nuova struttura.

### Modifica `package.json`

Aggiornare gli script `test`:

- `"test"`: `vitest run` (esegue tutti i progetti in CI)
- `"test:unit"`: `vitest run --project unit`
- `"test:nuxt"`: `vitest run --project nuxt`
- `"test:watch"`: `vitest --watch`
- `"test:coverage"`: `vitest run --coverage` (opzionale)

## 2. Struttura Directory e Migrazione Test Esistenti

### Directory target

```
test/
├── helpers/
│   ├── mocks.ts          # Stub per Nuxt UI, mock Supabase client
│   └── pinia.ts          # Factory per creare Pinia nelle unit test
├── setup.ts              # Cleanup globale (opzionale, per progetto nuxt)
├── unit/
│   ├── composables/
│   │   └── event-pairing/
│   │       └── pairingOptimizer.test.ts
│   └── utils/
│       ├── math.test.ts
│       ├── time.test.ts
│       └── standingsSubmission.test.ts
└── nuxt/
    └── components/
        ├── event/
        │   └── standings/
        │       └── StandingsCard.test.ts
        └── ui/
            └── BaseButton.test.ts
```

### Migrazione

1. **`app/composables/event-pairing/pairingOptimizer.test.ts`** → `test/unit/composables/event-pairing/pairingOptimizer.test.ts`
   - Logica pura, nessun auto-import Nuxt.
2. **`app/utils/standingsSubmission.test.ts`** → `test/unit/utils/standingsSubmission.test.ts`
   - Funzioni pure su dati.
3. **`app/components/event/standings/StandingsCard.test.ts`** → `test/nuxt/components/event/standings/StandingsCard.test.ts`
   - Componente Vue che stubba `ClientOnly`, `UIcon`, `UBadge`.

### Cleanup

Eliminare i 3 file `.test.ts` dalle posizioni attuali in `app/` per evitare duplicati.

## 3. Mock Strategy e Helpers

### Supabase

- Nei test **unit**, i composables che ricevono il client Supabase come parametro possono essere testati con un mock passato esplicitamente.
- Nei test **Nuxt**, usare `mockNuxtImport('useSupabaseClient', ...)` per restituire un mock con `vi.fn()` per `.from()`, `.select()`, etc.

### Pinia

- Nei test che montano componenti che usano Pinia, creare un'istanza fresh di Pinia tramite helper.
- `createTestPinia()` in `test/helpers/pinia.ts` restituisce un'istanza vuota per evitare stato condiviso.

### Nuxt UI Components

- Stubbare `UButton`, `UIcon`, `UBadge`, `ClientOnly` e altri componenti globali.
- `test/helpers/mocks.ts` esporta un oggetto `defaultStubs` riutilizzabile.

### Auto-imports Nuxt

- Usare `mockNuxtImport` per mockare `useRoute`, `useState`, etc. nel progetto `nuxt`.
- Nei test `unit`, importare esplicitamente le funzioni pure o usare `vi.mock` per moduli con side effects.

## 4. Test di Esempio Critici

### Progetto `unit`

#### `math.test.ts`
- `roundToDecimals(1.234, 2)` → `1.23`
- `roundToDecimals(1.25, 1)` → `1.3`
- `isCloseTo(0.1 + 0.2, 0.3)` → `true`
- `isCloseTo(1, 2)` → `false`

#### `time.test.ts`
- `formatDuration(0)` → `"00:00"`
- `formatDuration(65)` → `"01:05"`
- `formatDuration(3600)` → `"1:00:00"`
- `formatDuration(3661)` → `"1:01:01"`

#### `useTableCalculator.test.ts`
- `calculateTables(4)` → `{ canPlay: true, tables4: 1, tables3: 0 }`
- `calculateTables(5)` → `{ canPlay: false, tables4: 0, tables3: 0 }`
- `getTableSizes(10)` → `[4, 3, 3]`
- `buildPreviewTables([1,2,3,4,5,6,7])` → `[[1,2,3,4], [5,6,7]]`
- `formatTableEstimate(2, 1)` → `"2 tavoli da 4 e 1 tavolo da 3"`

### Progetto `nuxt`

#### `BaseButton.test.ts`
- Monta `BaseButton` con `action: 'create'` e verifica che lo stub di `UButton` riceva le props corrette (`color`, `icon`, `aria-label` derivata da `ACTION_MAP`).
- Verifica che `loading` e `disabled` vengano passati correttamente.

## 5. Comandi NPM e Integrazione CI/DevTools

### Script `package.json`

```json
{
  "test": "vitest run",
  "test:unit": "vitest run --project unit",
  "test:nuxt": "vitest run --project nuxt",
  "test:watch": "vitest --watch",
  "test:coverage": "vitest run --coverage"
}
```

### Nuxt DevTools

Con `@nuxt/test-utils/module` installato come modulo, apparirà un pannello **Vitest** nei DevTools per eseguire i test direttamente dall'interfaccia di sviluppo.

### CI

`pnpm test` esegue tutti i progetti in CI e fallisce se uno dei due progetti ha test rossi.

## Nota

I test E2E con Playwright **non** sono inclusi in questo design. Possono essere aggiunti in futuro come terzo progetto `e2e` in `vitest.config.ts` senza stravolgere la configurazione attuale.
