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

## Code Style & Conventions

### Vue Components

- **Add path comment at the beginning of every Vue file**: `<!-- app\components\ComponentName.vue -->` or `<!-- app\pages\page.vue -->`
- Use single backslash `\` in path comments (not `\\`)
- **Prefer inline type in `defineProps`** instead of a separate interface: `defineProps<{ prop: string }>()` rather than `interface Props { prop: string }`

### After File Modifications

- **Always run `pnpm lint` after modifying files** to ensure code quality and catch issues early

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

### Vue API References

- **<script setup>**: https://vuejs.org/api/sfc-script-setup.html
  - `defineModel()`: https://vuejs.org/api/sfc-script-setup.html#definemodel
  - `defineProps()` & `defineEmits()`: https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits

## General Principles

- Make **minimal, focused changes** - prefer small edits over large refactors
- **Verify file contents before editing** - never assume you know the current state
- **Never run destructive commands without explicit permission** (database changes, file deletions, etc.)
- When in doubt, ask for clarification rather than making assumptions
