# Documentation Index

<!-- docs/README.md -->

Master index of all project documentation.

## Already Documented

| Doc | What it covers | Priority |
|-----|---------------|----------|
| `AGENTS.md` | Core requirements, code style, Vue/Pinia conventions, error handling, testing strategy, fallow workflow | Required reading for all agents |
| `architecture/api.md` | CRUD matrix per entity: which operations exist, which `server/api/*` endpoint backs each, deliberate gaps (no player delete, no pairing CRUD) and inconsistencies (409 vs 500 on in-use delete) | API reference |
| `architecture/async-data-keys.md` | useAsyncData key naming convention (`{domain}-{scope}-{id}`), full inventory, collision history | Data fetching |
| `architecture/client-caching.md` | The two independent localStorage caching mechanisms (Pinia Colada cache persister vs. `getCached`/`setCached` session-store mirror) — what each stores, why they're kept separate | Data fetching |
| `architecture/commander-whitelists.md` | How commander2 whitelisting works: catalog fetch/cache, per-partner-type buckets, the Background/background-commander bidirectional split, client-side search filtering | Domain logic |
| `architecture/component-hierarchy.md` | Component tree for every page, reusable component catalog, directory structure | Component reference |
| `architecture/database.md` | RLS policies, denormalized stats tables, trigger architecture, migration conventions | Database ops |
| `architecture/event-flow.md` | Event lifecycle: creation → registration → playing → ended, DB mutations per phase | Event logic |
| `architecture/modal-url-sync.md` | URL query parameter sync for event page modals | URL state |
| `architecture/routes.md` | Complete route inventory, nested route gotchas, navigation patterns | Routing |
| `architecture/sound-effects.md` | uisfx sound-effects singleton, cue mapping for RoundTimer.vue, how to extend to other components | UI feedback |
| `architecture/state-flow.md` | DB → store → composable → component data flow, caching strategy | Architecture |
| `architecture/stores.md` | Pinia store overview, Setup API pattern, state categories, error handling | State management |
| `architecture/testing.md` | Test coverage matrix by area (unit/component/E2E): what's tested today, what isn't, where to add the next test | Test reference |
| `PROGRESS.md` | Backward-looking curated changelog + ADRs; what's actually been done | Architecture history |
| `CHANGELOG.md` | Raw commit-by-commit trail, newest first; the play-by-play behind `PROGRESS.md`'s distilled history | Architecture history |
| `BACKLOG.md` | Forward-looking, committed work items ranked by priority (P1–P3) with effort estimates (S/M/L) | Roadmap |
| `TODO.md` | Forward-looking scratch notes: loose observations, open questions, not yet committed | Roadmap (scratch) |
| `audits/skills-audit-checklist.md` | Skills audit completion checklist | Process |
| `audits/2026-05-24-skills-audit-report.md` | Full skills audit with scores and recommendations | Process |
| `audits/2026-07-12-vue-nuxt-conventions.md` | Vue 3.5+/Nuxt 4 convention compliance audit | Process |
| `superpowers/plans/` | Dated feature implementation plans (event flow standings, realtime, Scryfall migration, commander search) | Planning (historical) |
| `superpowers/specs/` | Dated feature design specs (event flow standings, realtime, testing) | Planning (historical) |

`architecture/` groups the docs that explain **how the app works** (data flow, stores, routes, DB, event lifecycle) as opposed to the root-level docs, which are entry points/process (this index, agent rules, roadmap, changelog).

---

## Documentation by Topic

### For Agent Onboarding

1. Start with `AGENTS.md` — core conventions and requirements
2. Read `architecture/state-flow.md` — understand the architecture
3. Check `architecture/component-hierarchy.md` — know the component landscape
4. Reference `architecture/stores.md` — state management patterns

### For Database Work

1. `architecture/database.md` — RLS, triggers, denormalized stats
2. `architecture/api.md` — CRUD matrix: what's possible per entity, which endpoint backs it
3. `architecture/event-flow.md` — which tables mutate on each event phase
4. `architecture/state-flow.md` — how store actions map to DB operations

### For Frontend Development

1. `architecture/component-hierarchy.md` — component catalog and page composition
2. `architecture/routes.md` — route structure and parameters
3. `architecture/async-data-keys.md` — data fetching conventions
4. `architecture/client-caching.md` — localStorage caching mechanisms (Colada persister vs. session-store mirror)
5. `architecture/modal-url-sync.md` — URL state persistence
6. `architecture/commander-whitelists.md` — commander2 partner/background whitelisting logic

### For Code Quality

1. `BACKLOG.md` — ranked, actionable cleanup items (Valibot form validation, DnD library adoption, etc.)
2. `AGENTS.md` — lint workflow, fallow integration
3. `audits/2026-05-24-skills-audit-report.md` — comprehensive audit results
4. `audits/2026-07-12-vue-nuxt-conventions.md` — Vue/Nuxt convention compliance

---

## Quick Reference

### File Paths

All docs live in `docs/` at project root:

```
docs/
├── README.md                    ← you are here
├── AGENTS.md
├── architecture/
│   ├── api.md
│   ├── async-data-keys.md
│   ├── client-caching.md
│   ├── commander-whitelists.md
│   ├── component-hierarchy.md
│   ├── database.md
│   ├── event-flow.md
│   ├── modal-url-sync.md
│   ├── routes.md
│   ├── sound-effects.md
│   ├── state-flow.md
│   ├── stores.md
│   └── testing.md
├── audits/
│   ├── skills-audit-checklist.md
│   ├── 2026-05-24-skills-audit-report.md
│   └── 2026-07-12-vue-nuxt-conventions.md
├── BACKLOG.md
├── PROGRESS.md
├── TODO.md
└── superpowers/
    ├── plans/
    │   ├── 2026-05-26-event-flow-standings-plan.md
    │   ├── 2026-05-27-multi-device-realtime-event-data.md
    │   ├── 2026-05-29-full-scryfall-to-supabase-migration.md
    │   ├── 2026-05-29-replace-scryfall-with-supabase.md
    │   ├── 2026-06-01-commander-search-partner-filtering.md
    │   └── 2026-07-21-commander-catalog-caching.md
    └── specs/
        ├── 2026-05-26-event-flow-standings-design.md
        ├── 2026-05-27-multi-device-realtime-event-data.md
        └── 2026-05-31-add-testing-design.md
```

### Conventions

- Path comments in every source file: `<!-- app\components\X.vue -->` or `// app\stores\x.ts`
- JSDoc on all store exports
- Italian UI strings, English code comments
- Run `pnpm lint` after any file modification
