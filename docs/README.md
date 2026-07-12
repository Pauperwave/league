# Documentation Index

<!-- docs/README.md -->

Master index of all project documentation.

## Already Documented

| Doc | What it covers | Priority |
|-----|---------------|----------|
| `AGENTS.md` | Core requirements, code style, Vue/Pinia conventions, error handling, testing strategy, fallow workflow | Required reading for all agents |
| `async-data-keys.md` | useAsyncData key naming convention (`{domain}-{scope}-{id}`), full inventory, collision history | Data fetching |
| `component-hierarchy.md` | Component tree for every page, reusable component catalog, directory structure | Component reference |
| `database.md` | RLS policies, denormalized stats tables, trigger architecture, migration conventions | Database ops |
| `event-flow.md` | Event lifecycle: creation → registration → playing → ended, DB mutations per phase | Event logic |
| `modal-url-sync.md` | URL query parameter sync for event page modals | URL state |
| `reinventing-the-wheel.md` | Audit of 11 patterns that should use libraries | Code quality |
| `prompt-for-ai.md` | Delegation prompt for fixing reinventing issues | AI delegation |
| `routes.md` | Complete route inventory, nested route gotchas, navigation patterns | Routing |
| `state-flow.md` | DB → store → composable → component data flow, caching strategy | Architecture |
| `stores.md` | Pinia store overview, Setup API pattern, state categories, error handling | State management |
| `bugs.md` | Known bugs (minimal) | Maintenance |
| `buttons.md` | ActionButton component pattern discussion | UI patterns |
| `TODO.md` | Future features: stepper, timer, alarm sound, Vite optimizeDeps | Roadmap |
| `audits/skills-audit-checklist.md` | Skills audit completion checklist | Process |
| `audits/skills-audit-report.md` | Full skills audit with scores and recommendations | Process |
| `audits/2026-07-12-vue-nuxt-conventions.md` | Vue 3.5+/Nuxt 4 convention compliance audit | Process |
| `superpowers/` | Feature specs and plans (multi-device realtime, event flow) | Planning |

---

## Documentation by Topic

### For Agent Onboarding

1. Start with `AGENTS.md` — core conventions and requirements
2. Read `state-flow.md` — understand the architecture
3. Check `component-hierarchy.md` — know the component landscape
4. Reference `stores.md` — state management patterns

### For Database Work

1. `database.md` — RLS, triggers, denormalized stats
2. `event-flow.md` — which tables mutate on each event phase
3. `state-flow.md` — how store actions map to DB operations

### For Frontend Development

1. `component-hierarchy.md` — component catalog and page composition
2. `routes.md` — route structure and parameters
3. `async-data-keys.md` — data fetching conventions
4. `modal-url-sync.md` — URL state persistence

### For Code Quality

1. `reinventing-the-wheel.md` — patterns to replace with libraries
2. `AGENTS.md` — lint workflow, fallow integration
3. `audits/skills-audit-report.md` — comprehensive audit results
4. `audits/2026-07-12-vue-nuxt-conventions.md` — Vue/Nuxt convention compliance

---

## Quick Reference

### File Paths

All docs live in `docs/` at project root:

```
docs/
├── README.md                    ← you are here
├── AGENTS.md
├── async-data-keys.md
├── audits/
│   ├── skills-audit-checklist.md
│   ├── skills-audit-report.md
│   └── 2026-07-12-vue-nuxt-conventions.md
├── bugs.md
├── buttons.md
├── component-hierarchy.md
├── database.md
├── event-flow.md
├── modal-url-sync.md
├── prompt-for-ai.md
├── reinventing-the-wheel.md
├── routes.md
├── state-flow.md
├── stores.md
├── TODO.md
└── superpowers/
    ├── multi-device-realtime.md
    └── event-flow.md
```

### Conventions

- Path comments in every source file: `<!-- app\components\X.vue -->` or `// app\stores\x.ts`
- JSDoc on all store exports
- Italian UI strings, English code comments
- Run `pnpm lint` after any file modification
