# Core requirements

- The end goal is stability, speed and great user experience

## Code quality requirements

- Create and update a `PROGRESS.md` file to track the overall progress of the project and document the architecture decisions made
- Follow standard TypeScript best practices and conventions
- Accessibility should always be a first-class consideration and should be part of the initial planning and design
- Use the Composition API when creating Vue components
- Add comments only to explain logic or non-obvious implementations
- Keep functions focused and manageable (generally under 50 lines), and extract them into separate files in the `app/composables` or `app/utils` directories when needed
- This project uses Nuxt v4 directory structure, meaning that the `app/` is the source folder, and components, pages, etc. live inside it
- Use error handling patterns consistently throughout the codebase
- Ensure you write stricly type-safe code, for example by ensuring you always check when accessing an array value by index
- Write unit tests for core functionality using `vitest`
- Write end-to-end tests using Playwright and `@nuxt/test-utils`
- Use `@nuxt/ui` for UI components
- Use `tailwindcss` v4 for styling
- Use `eslint` for code quality and consistency
- Use `valibot` for validation instead of `zod`

## Database Modifications

- **ALWAYS ask permission before modifying the database**, even if you have MCP access. Never execute DDL operations (CREATE, ALTER, DROP, etc.) without explicit user approval.

See `docs/database.md` for full database documentation including RLS policies, denormalized stats tables, and migration conventions.

See `docs/async-data-keys.md` for the `useAsyncData` key naming convention and full key inventory.

## Code Style & Conventions

### Path Comments

Add a path comment at the beginning of **every source file** so AI agents always know which file they are reading:

- **Vue files**: `<!-- app\components\ComponentName.vue -->`
- **TypeScript/JavaScript files**: `// app\stores\storeName.ts`
- Use single backslash `\` in path comments (not `\\`)

### Vue Components

- **Prefer inline type in `defineProps`** instead of a separate interface: `defineProps<{ prop: string }>()` rather than `interface Props { prop: string }`
- **Props with defaults (Vue 3.4+):** use reactive destructuring on `defineProps`, not `withDefaults` (legacy):

```vue
<script setup lang="ts">
const {
  totalScore,
  loading = false,
} = defineProps<{
  totalScore: number
  loading?: boolean
}>()
</script>
```

  - Defaults live next to each prop in the destructuring pattern
  - Destructured props stay reactive in Vue 3.4+
  - Avoid `const props = withDefaults(defineProps<...>(), { ... })` in new or refactored code

### After File Modifications

- **Always run `pnpm lint` and `pnpm typecheck` after modifying files.**
- **Policy: 0 warnings, 0 errors.** The repo is kept at a clean baseline on both `pnpm lint` and `pnpm typecheck` — do not merge or hand off work that leaves either with warnings or errors, including in files you didn't touch but happened to affect (e.g. via shared types or refactors).
- If a fix isn't safe to make blindly (e.g. it would require guessing at a schema, or silently changing behavior), stop and flag it instead of suppressing the warning or casting to `any`/`unknown` to make it go away.
- Never leave a `// eslint-disable` or `@ts-ignore` as the fix for a real warning — resolve the underlying type or lint issue instead.

### Pinia Stores

- Use **Setup API** (`defineStore('id', () => { ... })`) exclusively
- Document state, getters, and actions with JSDoc comments
- Return an explicit public API from `defineStore`, even for members no current consumer happens to use yet — stores are a complete data-layer abstraction, not a consumer-driven one. `fallow`'s `unused-store-members` check is disabled repo-wide in `.fallowrc.json` for exactly this reason (it would otherwise flag most of every store's `error`/`loading`/`clearError` members as dead).
- **Session stores** (ephemeral UI state) must implement `reset()` to clear state between rounds

### State Management Categories

| Category | Stores | Persistence | Patterns |
|----------|--------|-------------|----------|
| **Supabase stores** | `useLeagueStore`, `useRulesetStore`, `usePlayerStore`, `useEventStore` | Persistent | `initialized` flags, optimistic updates, `{ success, error?, data? }` returns |
| **Session stores** | `useRankingsStore`, `useKillsStore`, `useVotesStore`, `useCommandersStore` | Ephemeral | `Map<number, ...>` or `Set<number>`, `reset()` between rounds |

### Error Handling

- Store actions return `{ success: boolean, error?: string, data?: T }`
- Log errors with store/action prefix: `console.error('[useXxxStore] actionName error:', err)`
- Destructure Supabase `error` with an alias (`error: supaError`) to avoid shadowing

### Composables

- Extract focused logic into `app/composables/` or `app/utils/`
- SSR-friendly composables wrap store calls in `useAsyncData` and return `{ data, pending, error, refresh }`

#### General Rule for composables returning refs used in templates

**Always destructure at the `<script setup>` top level:**

```vue
<!-- ✅ Correct pattern -->
<script setup lang="ts">
const { showNextRoundModal, showScoreModal, selectedPairingId, ... } = useEventModals(...)
const { confirmNextRound, handleAdvance, ... } = useEventLifecycle(...)
const { handlePlayerCreate, playerToEdit, ... } = useEventPlayers(...)
</script>

<!-- ❌ Avoid — nested refs won't auto-unwrap in template -->
<script setup lang="ts">
const modals = useEventModals(...)
const lifecycle = useEventLifecycle(...)
</script>
```

If you have many refs and don't want to list them all, you can use `toRefs()` inside the composable on the returned object, but explicit destructuring is more readable and idiomatic in Nuxt/Vue 3.

### Language

- **UI-facing strings**: Italian (e.g., `'Errore nel caricamento leghe'`)
- **Code comments, logs, and internal errors**: English

### Testing

- **Unit tests**: `vitest` for composables, utilities, and store logic
- **E2E tests**: Playwright + `@nuxt/test-utils` for critical user flows (event creation, round progression, score submission)

## Common Agent Workflow

After generating or editing code:

1. **Run the audit**: `pnpm audit` (`fallow audit --format json`)
2. **Inspect findings** — check complexity hotspots, duplication, and dead code
3. **Decide on each finding** using the decision tree below
4. **Apply safe fixes** — extract shared code, split large functions, remove dead code
5. **Use narrow exceptions** for intentional patterns (documented with a real reason)
6. **Hand to human reviewer** with `fallow` evidence (scores, hotspots, targets) alongside the PR

### Compliance Goal

- `pnpm health` shows **`Above threshold: 0`** for the thresholds chosen for this repo
- Duplication, architecture violations, and cleanup findings are either resolved or narrowly documented
- Every exclusion has a real reason (public API, framework convention, generated code, migration debt)

### Decision Tree for Findings

For each `fallow` finding, choose one of:

1. **Fix it now** — delete unused code, extract/simplify complex functions, consolidate duplicates
2. **Keep it intentionally** — add the narrowest possible exception with a documented reason
3. **Change the policy** — adjust thresholds only if that reflects an intentional repo-wide standard

Prefer narrow exceptions over broad ignores:
- Inline suppression for one line or one file
- `ignoreExports` for a specific export
- `ignoreDependencies` for a specific dependency
- `overrides` for a specific directory or pattern

### Staged Adoption

If the repo cannot be fully cleaned in one pass, save per-analysis baselines and use `fallow audit` as a gate on new issues while cleanup continues. Baselines are a temporary migration aid, not the desired steady state.

```bash
fallow dead-code --save-baseline fallow-baselines/dead-code.json
fallow health    --save-baseline fallow-baselines/health.json
fallow dupes     --save-baseline fallow-baselines/dupes.json

fallow audit \
  --dead-code-baseline fallow-baselines/dead-code.json \
  --health-baseline    fallow-baselines/health.json \
  --dupes-baseline     fallow-baselines/dupes.json
```

### Available Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dead-code` | Check for unused exports and dead files |
| `pnpm audit` | Full audit as JSON (complexity, duplication, maintainability) |
| `pnpm health` | Health report with scores, hotspots, and targets |

## Reference Documentation

- **Vue**: https://vuejs.org/llms.txt (summary) and https://vuejs.org/llms-full.txt (complete guidelines)
- **Nuxt**: https://nuxt.com/llms-full.txt
- **Nuxt UI**: https://ui.nuxt.com/llms.txt (summary) and https://ui.nuxt.com/llms-full.txt (complete guidelines)
- **Bun**: https://bun.sh/llms-full.txt
- **Nitro**: https://nitro.build/llms.txt (summary) and https://nitro.build/llms-full.txt (complete guidelines)
- **Supabase**: https://supabase.com/llms.txt
- **Vercel**: https://vercel.com/docs/llms-full.txt
- **UX Patterns**: https://uxpatterns.dev/en/llms.txt (summary) and https://uxpatterns.dev/en/llms-full.txt (complete guidelines)
- **Vite**: https://vite.dev/llms.txt (summary) and https://vite.dev/llms-full.txt (complete guidelines)
- **Vue Flow**: https://vueflow.dev/llms.txt (summary) and https://vueflow.dev/llms-full.txt (complete guidelines)

### Vue API References

- **<script setup>**: https://vuejs.org/api/sfc-script-setup.html
  - `defineModel()`: https://vuejs.org/api/sfc-script-setup.html#definemodel
  - `defineProps()` & `defineEmits()`: https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits

## General Principles

- Make **minimal, focused changes** - prefer small edits over large refactors
- **Verify file contents before editing** - never assume you know the current state
- **Never run destructive commands without explicit permission** (database changes, file deletions, etc.)
- When in doubt, ask for clarification rather than making assumptions
