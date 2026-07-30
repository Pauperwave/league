# Replace Scryfall API with Supabase `mtg_commanders` lookups

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all direct Scryfall API calls for commander lookups and replace them with queries against the local `mtg_commanders` Supabase table, which is now fully populated.

**Architecture:** The `mtg_commanders` table contains all commander data (name, color identity, CMC, mana cost, image URLs, partner info, etc.). We will create a new `useCommanderSearch` composable (Supabase-based) to replace `useCardSearch`, and migrate the `/decks` page to use `fetchCommandersByNames` from `useCommanderCards` instead of `fetchCardsCollection`.

**Tech Stack:** Nuxt 4, Vue 3, Supabase (`@nuxtjs/supabase`), Valibot, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/composables/useCommanderCards.ts` | Modify | Export `mapToCommanderCard` and add `getArtCropUrl` helper |
| `app/composables/useCommanderSearch.ts` | Create | New Supabase-based search composable replacing `useCardSearch` |
| `app/composables/useCardSearch.ts` | Delete | Remove old Scryfall-based search composable |
| `app/components/CardPreview.vue` | Modify | Accept `CommanderCard` instead of custom `ScryfallCard` interface |
| `app/components/CommanderSearch.vue` | Modify | Import from `useCommanderSearch` instead of `useCardSearch` |
| `app/pages/decks/index.vue` | Modify | Use `fetchCommandersByNames` + `CommanderCard` instead of Scryfall helpers |
| `app/pages/deck/[deckSlug].vue` | Modify | Fix `getArtCrop` → `getArtCropUrl` import |
| `app/components/CommanderDeckCard.vue` | Modify | Fix `getArtCrop` → `getArtCropUrl` import |
| `docs/state-flow.md` | Modify | Update `useCardSearch` reference to `useCommanderSearch` |

---

### Task 1: Export `mapToCommanderCard` and add `getArtCropUrl` + `backImageUrl`

**Files:**
- Modify: `app/composables/useCommanderCards.ts`

- [ ] **Step 1: Add `backImageUrl` to `CommanderCardSchema`**

```ts
const CommanderCardSchema = v.object({
  scryfallId: v.string(),
  scryfallUrl: v.nullable(v.string()),
  name: v.string(),
  imageUrl: v.nullable(v.string()),
  backImageUrl: v.nullable(v.string()), // NEW
  artCropUrl: v.nullable(v.string()),
  manaCost: v.nullable(v.string()),
  cmc: v.number(),
  colorIdentity: v.array(v.string()),
  typeLine: v.nullable(v.string()),
  keywords: v.array(v.string()),
  oracleText: v.nullable(v.string()),
  partnerType: PartnerTypeSchema,
  partnerWithScryfallId: v.nullable(v.string()),
  partnerGroupTag: v.nullable(v.string()),
  edhrecRank: v.nullable(v.number()),
  releasedAt: v.nullable(v.string()),
})
```

- [ ] **Step 2: Map `backImageUrl` in `mapToCommanderCard`**

```ts
function mapToCommanderCard(row: Record<string, any>): CommanderCard {
  const raw = {
    scryfallId: row.scryfall_id,
    scryfallUrl: row.scryfall_url ?? null,
    name: row.card_name,
    imageUrl: row.image_url ?? null,
    backImageUrl: row.card_faces?.[1]?.image_uris?.normal ?? null, // NEW
    artCropUrl: row.art_crop_url ?? null,
    manaCost: row.mana_cost ?? null,
    cmc: row.cmc ?? 0,
    colorIdentity: row.color_identity ?? [],
    typeLine: row.type_line ?? null,
    keywords: row.keywords ?? [],
    oracleText: row.oracle_text ?? null,
    partnerType: row.partner_type ?? null,
    partnerWithScryfallId: row.partner_with_scryfall_id ?? null,
    partnerGroupTag: row.partner_group_tag ?? null,
    edhrecRank: row.edhrec_rank ?? null,
    releasedAt: row.released_at ?? null,
  }

  return v.parse(CommanderCardSchema, raw)
}
```

- [ ] **Step 3: Export `mapToCommanderCard` and add `getArtCropUrl`**

Add after `mapToCommanderCard` definition:

```ts
export { mapToCommanderCard }

export function getArtCropUrl(card: CommanderCard | null): string | null {
  return card?.artCropUrl ?? null
}
```

- [ ] **Step 4: Run typecheck on the composable**

```bash
pnpm typecheck
```
Expected: no errors in `useCommanderCards.ts`

---

### Task 2: Create `useCommanderSearch.ts`

**Files:**
- Create: `app/composables/useCommanderSearch.ts`
- Delete: `app/composables/useCardSearch.ts` (in Task 5)

- [ ] **Step 1: Write the new composable**

```ts
// app/composables/useCommanderSearch.ts
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { NUMBER_OF_SUGGESTED_CARDS, MIN_QUERY_LENGTH, DEBOUNCE_DELAY } from '~/config/searchConfig'
import { mapToCommanderCard, type CommanderCard } from './useCommanderCards'

interface SuggestionMeta {
  manaCost: string
  tokens: string[]
}

export function useCommanderSearch(options: { whitelist?: string[] | null } = {}) {
  const { whitelist = null } = options
  const supabase = useSupabaseClient()

  const query = ref('')
  const suggestions = ref<string[]>([])
  const showSuggestions = ref(false)
  const selectedIndex = ref(-1)
  const isLoading = ref(false)
  const card = ref<CommanderCard | null>(null)
  const suggestionMeta = ref<Record<string, SuggestionMeta>>({})

  const tokenizeManaCost = (manaCost: string | undefined): string[] => {
    if (!manaCost || typeof manaCost !== 'string') return []
    const matches = manaCost.match(/\{[^}]+\}/g)
    return matches || []
  }

  const fetchSuggestions = async (q: string) => {
    if (!q || q.length < MIN_QUERY_LENGTH) {
      suggestions.value = []
      showSuggestions.value = false
      selectedIndex.value = -1
      return
    }

    isLoading.value = true

    try {
      let names: string[] = []

      if (Array.isArray(whitelist) && whitelist.length > 0) {
        names = whitelist
          .filter((name: string) => name.toLowerCase().includes(q.toLowerCase()))
          .slice(0, NUMBER_OF_SUGGESTED_CARDS)
      }
      else {
        const { data, error } = await supabase
          .from('mtg_commanders')
          .select('card_name, mana_cost')
          .ilike('card_name', `%${q}%`)
          .limit(NUMBER_OF_SUGGESTED_CARDS)

        if (error) throw error

        const updates: Record<string, SuggestionMeta> = {}
        for (const row of data || []) {
          const manaCost = row.mana_cost || ''
          updates[row.card_name] = {
            manaCost,
            tokens: tokenizeManaCost(manaCost),
          }
        }
        suggestionMeta.value = { ...suggestionMeta.value, ...updates }
        names = (data || []).map(row => row.card_name)
      }

      suggestions.value = names
      if (names.length > 0) {
        showSuggestions.value = true
      }
    }
    catch (error) {
      console.error('[useCommanderSearch] Error fetching suggestions:', error)
    }
    finally {
      isLoading.value = false
    }
  }

  const debouncedFetch = useDebounceFn(fetchSuggestions, DEBOUNCE_DELAY)

  watch(query, (newQuery) => {
    debouncedFetch(newQuery)
  })

  const fetchCardDetails = async (name: string) => {
    const { data, error } = await supabase
      .from('mtg_commanders')
      .select('*')
      .eq('card_name', name)
      .single()

    if (error || !data) {
      console.error(`[useCommanderSearch] Commander not found: "${name}"`, error?.message)
      card.value = null
      return
    }

    try {
      card.value = mapToCommanderCard(data)
    }
    catch (err) {
      console.error(`[useCommanderSearch] Validation error for "${name}":`, err)
      card.value = null
    }
  }

  const handleSelect = (name: string | null) => {
    query.value = name || ''
    showSuggestions.value = false
    selectedIndex.value = -1

    if (name) {
      fetchCardDetails(name)
    }
    else {
      card.value = null
    }
  }

  const navigateSuggestions = (direction: 'up' | 'down') => {
    if (!showSuggestions.value || suggestions.value.length === 0) return
    if (direction === 'down') {
      selectedIndex.value = Math.min(selectedIndex.value + 1, suggestions.value.length - 1)
    }
    else {
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
    }
  }

  const selectCurrent = () => {
    if (selectedIndex.value >= 0 && selectedIndex.value < suggestions.value.length) {
      handleSelect(suggestions.value[selectedIndex.value] || null)
    }
    else if (suggestions.value.length > 0) {
      handleSelect(suggestions.value[0] || null)
    }
  }

  const closeSuggestions = () => {
    showSuggestions.value = false
    selectedIndex.value = -1
  }

  const openSuggestions = () => {
    if (suggestions.value.length > 0) {
      showSuggestions.value = true
    }
  }

  return {
    query,
    setQuery: (value: string) => { query.value = value },
    suggestions,
    showSuggestions,
    setShowSuggestions: (value: boolean) => { showSuggestions.value = value },
    selectedIndex,
    isLoading,
    card,
    handleSelect,
    suggestionMeta,
    navigateSuggestions,
    selectCurrent,
    closeSuggestions,
    openSuggestions,
  }
}
```

---

### Task 3: Update `CardPreview.vue` to accept `CommanderCard`

**Files:**
- Modify: `app/components/CardPreview.vue`

- [ ] **Step 1: Replace the interface with `CommanderCard` import**

```ts
<!-- app\components\CardPreview.vue -->
<script setup lang="ts">
import { computed, watch } from 'vue'
import type { CommanderCard } from '~/composables/useCommanderCards'

const props = defineProps<{
  card: CommanderCard | null
}>()
```

- [ ] **Step 2: Simplify color resolution using `CommanderCard` fields**

Replace all color extraction functions with:

```ts
function resolveCardColors(card: CommanderCard): string[] {
  const colors = card.colorIdentity
  if (colors.length === 0) return ['C']
  return colors
}
```

Remove `extractColorsFromManaCost`, `resolveDoubleFacedColors`, `resolveSingleFacedColors` entirely.

- [ ] **Step 3: Update image computed properties**

```ts
const frontImage = computed(() => {
  return props.card?.imageUrl ?? null
})

const backImage = computed(() => {
  return props.card?.backImageUrl ?? null
})
```

Remove `isDoubleFaced` computed.

---

### Task 4: Migrate `CommanderSearch.vue`

**Files:**
- Modify: `app/components/CommanderSearch.vue`

- [ ] **Step 1: Replace import**

```ts
import { useCommanderSearch } from '~/composables/useCommanderSearch'
```

- [ ] **Step 2: Replace composable call**

Replace:
```ts
} = useCardSearch({
  detectFlags: false,
  whitelist: props.whitelist,
})
```

With:
```ts
} = useCommanderSearch({
  whitelist: props.whitelist,
})
```

- [ ] **Step 3: Update suggestionMeta access**

Replace `suggestionMeta[suggestion]?.tokens?.length` and `suggestionMeta[suggestion].tokens` with:
```ts
suggestionMeta[suggestion]?.tokens?.length
suggestionMeta[suggestion].tokens
```

(These stay the same because the return shape is identical.)

---

### Task 5: Delete `useCardSearch.ts`

**Files:**
- Delete: `app/composables/useCardSearch.ts`

- [ ] **Step 1: Remove the file**

```bash
git rm app/composables/useCardSearch.ts
```

---

### Task 6: Migrate `app/pages/decks/index.vue`

**Files:**
- Modify: `app/pages/decks/index.vue`

- [ ] **Step 1: Replace imports**

```ts
import {
  fetchCommandersByNames,
  type CommanderCard,
} from '~/composables/useCommanderCards'
```

- [ ] **Step 2: Replace cache and sort helpers**

Replace:
```ts
// Scryfall data for color / mana cost sorting (fetched lazily)
const scryfallCache = ref(new Map<string, ScryfallCard>())
const scryfallLoading = ref(false)
```

With:
```ts
// Commander data for color / mana cost sorting (fetched lazily)
const commanderCache = ref(new Map<string, CommanderCard>())
const commanderDataLoading = ref(false)
```

- [ ] **Step 3: Replace watch logic**

Replace:
```ts
watch(selectedSort, async (newSort) => {
  if ((newSort === 'color' || newSort === 'mana-cost') && scryfallCache.value.size === 0) {
    const uniqueCommanders = [...new Set(commanderDecksStore.decks.map(d => d.commander_1_name))]
    if (uniqueCommanders.length > 0) {
      scryfallLoading.value = true
      const cards = await fetchCardsCollection(uniqueCommanders)
      scryfallCache.value = cards
      scryfallLoading.value = false
    }
  }
})
```

With:
```ts
watch(selectedSort, async (newSort) => {
  if ((newSort === 'color' || newSort === 'mana-cost') && commanderCache.value.size === 0) {
    const uniqueCommanders = [...new Set(commanderDecksStore.decks.map(d => d.commander_1_name))]
    if (uniqueCommanders.length > 0) {
      commanderDataLoading.value = true
      const cards = await fetchCommandersByNames(uniqueCommanders)
      commanderCache.value = cards
      commanderDataLoading.value = false
    }
  }
})
```

- [ ] **Step 4: Replace helper functions**

Replace:
```ts
function getScryfallData(deck: CommanderDeck): ScryfallCard | undefined {
  return scryfallCache.value.get(deck.commander_1_name)
}
```

With:
```ts
function getCommanderData(deck: CommanderDeck): CommanderCard | undefined {
  return commanderCache.value.get(deck.commander_1_name)
}
```

Replace:
```ts
function colorSortKey(deck: CommanderDeck): string {
  const colors = getCardColorIdentity(getScryfallData(deck))
  if (colors.length === 0) return 'ZZZZ'
  const count = colors.length.toString().padStart(2, '0')
  const order = colors
    .sort((a, b) => colorOrder.indexOf(a) - colorOrder.indexOf(b))
    .join('')
  return `${count}${order}`
}

function manaCostSortKey(deck: CommanderDeck): number {
  return getCardCmc(getScryfallData(deck))
}
```

With:
```ts
function colorSortKey(deck: CommanderDeck): string {
  const card = getCommanderData(deck)
  const colors = card?.colorIdentity ?? []
  if (colors.length === 0) return 'ZZZZ'
  const count = colors.length.toString().padStart(2, '0')
  const order = [...colors]
    .sort((a, b) => colorOrder.indexOf(a) - colorOrder.indexOf(b))
    .join('')
  return `${count}${order}`
}

function manaCostSortKey(deck: CommanderDeck): number {
  return getCommanderData(deck)?.cmc ?? 0
}
```

- [ ] **Step 5: Update template loading condition**

Replace:
```vue
<div v-if="commanderDecksStore.loading || scryfallLoading" class="flex items-center justify-center py-12">
```

With:
```vue
<div v-if="commanderDecksStore.loading || commanderDataLoading" class="flex items-center justify-center py-12">
```

---

### Task 7: Fix `app/pages/deck/[deckSlug].vue` imports

**Files:**
- Modify: `app/pages/deck/[deckSlug].vue`

- [ ] **Step 1: Replace import**

```ts
import { getArtCropUrl, useCommanderCards } from '~/composables/useCommanderCards'
```

- [ ] **Step 2: Replace `getArtCrop` calls**

Replace:
```ts
const art1 = computed(() => getArtCrop(commander1Data.value))
const art2 = computed(() => getArtCrop(commander2Data.value))
```

With:
```ts
const art1 = computed(() => getArtCropUrl(commander1Data.value))
const art2 = computed(() => getArtCropUrl(commander2Data.value))
```

- [ ] **Step 3: Fix `mana_cost` reference in template**

Replace `commander1Data?.mana_cost` with `commander1Data?.manaCost`.

---

### Task 8: Fix `app/components/CommanderDeckCard.vue` imports

**Files:**
- Modify: `app/components/CommanderDeckCard.vue`

- [ ] **Step 1: Replace import**

```ts
import { getArtCropUrl, useCommanderCards } from '~/composables/useCommanderCards'
```

- [ ] **Step 2: Replace `getArtCrop` calls**

Replace `getArtCrop(commander1Data.value)` with `getArtCropUrl(commander1Data.value)` and same for `commander2Data`.

---

### Task 9: Update `docs/state-flow.md`

**Files:**
- Modify: `docs/state-flow.md`

- [ ] **Step 1: Update composable reference**

Replace `| \`useCardSearch()\` | Card search with debounce |` with `| \`useCommanderSearch()\` | Local DB commander search with debounce |`.

---

### Task 10: Typecheck and Lint

- [ ] **Step 1: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors in modified files (pre-existing errors in other files are acceptable).

- [ ] **Step 2: Run lint on modified files**

```bash
pnpm lint
```

Fix any lint errors introduced by the changes.

---

### Task 11: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add app/composables/useCommanderCards.ts

git add app/composables/useCommanderSearch.ts

git rm app/composables/useCardSearch.ts

git add app/components/CardPreview.vue

git add app/components/CommanderSearch.vue

git add app/pages/decks/index.vue

git add app/pages/deck/[deckSlug].vue

git add app/components/CommanderDeckCard.vue

git add docs/state-flow.md

git commit -m "refactor: replace Scryfall API with Supabase mtg_commanders for search and deck listing"
```

---

## Spec Coverage Checklist

| Requirement | Task |
|-------------|------|
| Remove Scryfall API calls from commander search | Task 2 (new composable), Task 5 (delete old) |
| Remove Scryfall API calls from `/decks` page | Task 6 |
| Preserve sort by color and mana cost | Task 6 (uses `colorIdentity` and `cmc` from DB) |
| Preserve card preview with images | Task 3 (adapted to `CommanderCard`) |
| Preserve suggestion metadata (mana cost tokens) | Task 2 (`tokenizeManaCost` on DB `mana_cost`) |
| Preserve whitelist filtering | Task 2 (local filter path retained) |
| Fix broken `getArtCrop` imports | Task 1, 7, 8 |
| Update documentation | Task 9 |

## Placeholder Scan

- [x] No "TBD", "TODO", "implement later"
- [x] No "Add appropriate error handling" without code
- [x] No "Write tests for the above" without test code
- [x] No "Similar to Task N" — each task is self-contained
- [x] All types (`CommanderCard`, `SuggestionMeta`) are defined in earlier tasks
