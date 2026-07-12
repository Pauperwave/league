# app/utils/CLAUDE.md

**Check this list before writing a new helper function anywhere in the app.** These are small, general-purpose, already exist, and are auto-imported (no `import` needed inside `app/`) — a near-duplicate (e.g. another debounced localStorage cache, another duration formatter) is a sign the existing one should be reused or extended instead.

| File | Exports | Use for |
|------|---------|---------|
| `error.ts` | `toErrorMessage(err: unknown, fallback?: string): string` | Turning a caught `unknown`/`Error`/`string` into a display message. **Always use this in store `catch` blocks** — never `err.message` directly, `err` is `unknown`. |
| `logger.ts` | `logInfo`, `logWarn`, `logError`, `logDebug` (all `(component: string, message: string, ...args)`) | Console logging with a `[component] message` prefix. `logDebug` is dev-only (`import.meta.dev`). Prefer these over raw `console.*` so logs stay greppable by component name. |
| `localStorage.ts` | `getCached<T>(key, ttlMs): T \| null`, `setCached<T>(key, data): void` | TTL-based localStorage caching (SSR-safe — no-ops on the server, swallows quota/parse errors). Use this instead of a bespoke `localStorage.getItem`/`JSON.parse` block. |
| `math.ts` | `roundToDecimals(value, decimals?)`, `isCloseTo(a, b, epsilon?)` | Decimal rounding and float-tolerant equality. Use `isCloseTo` instead of `a === b` for any computed/averaged score comparison. |
| `slug.ts` | `slugify(text): string` | URL-safe slug generation (wraps the `slugify` package with project defaults: lowercase, strict). Player/deck slugs must go through this, not a hand-rolled regex. |
| `time.ts` | `formatDuration(totalSeconds): string` | Formats seconds as `MM:SS` / `H:MM:SS`. Used by round timers — don't reimplement with `Date`/`Intl` (timezone bugs). |
| `actionButton.ts` | `ACTION_MAP`, `ActionType` | The `remove`/`edit`/`view` → `{ color, icon, label }` mapping used by `BaseButton.vue`/`ActionButtons.vue`. Add a new action type here, not as inline props at each call site. |
| `standingsSubmission.ts` | `buildStandingsSubmissionMap(...)` | Event-page-specific: computes per-player "has this table fully submitted its round data" from rankings/votes/kills state. Domain logic, not general-purpose — don't reuse outside the event page without checking it still fits. |

## Related, but not here

- **`shared/utils/playerSimilarity.ts`** (isomorphic, not `app/`-only): `calculateNameSimilarity`, `findSimilarPlayers`, `isPlayerNameDistinct` — fuzzy player-name matching (Levenshtein) used for duplicate-player detection on creation. If you need name-similarity logic anywhere, it's already here.
- **`shared/utils/types/`**: DB row types (`Tables<'x'>` aliases) and extended domain types (`PairingWithResults`, `TournamentPlayer`, etc.) — not helper functions, but check here before defining a new local interface that duplicates a DB shape.
- **Component-local helpers**: some formatting/mapping logic still lives inline in individual components (grep before assuming `app/utils/` is exhaustive). If you find yourself copying a inline helper to a second component, that's the signal to promote it here instead.
