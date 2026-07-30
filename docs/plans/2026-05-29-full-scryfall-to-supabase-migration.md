# Full Scryfall-to-Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every runtime Scryfall API call for commander data with Supabase `mtg_commanders` queries. Extend the DB schema to store all fields the UI needs (double-faced images, large URLs, back-face data). The DB is the single source of truth.

**Architecture:** Add missing columns to `mtg_commanders` for large/back-face images. Update the sync script to populate them. Build a `useCommanderSearch` composable that queries Supabase for autocomplete + card preview. Update all UI components (`CommanderSearch`, `CardPreview`, `CommanderModal`, deck pages) to consume DB data only. When inserting a commander at a table, suggest the player's most-used commanders first, then the rest by `edhrec_rank`.

**Tech Stack:** Nuxt 3, Vue 3, Supabase (Postgres), Valibot, Tailwind CSS, `@nuxt/ui`.

---

## File Structure

| File | Responsibility |
|------|--------------|
| `server/api/admin/sync-commanders.post.ts` | One-off sync script: fetches all commanders from Scryfall and upserts into `mtg_commanders`. Must populate all columns. |
| `app/composables/useCommanderCards.ts` | Schema, mapping, and helpers for `mtg_commanders` rows (`CommanderCard`). Exports `getArtCrop`. |
| `app/composables/useCommanderSearch.ts` | New composable. Replaces `useCardSearch` for commander autocomplete + preview. Queries Supabase. Supports whitelist + player prioritization. |
| `app/composables/useCommanderWhitelists.ts` | New composable. Replaces `useCardWhitelists`. Builds whitelist arrays by querying `mtg_commanders` (`partner_type`, `keywords`). |
| `app/components/CommanderSearch.vue` | Autocomplete input. Will import `useCommanderSearch` instead of `useCardSearch`. |
| `app/components/CardPreview.vue` | Card image preview. Will accept `CommanderCard` and use DB fields (`largeImageUrl`, `backLargeImageUrl`, `isDoubleFaced`). |
| `app/components/modals/CommanderModal.vue` | Modal for assigning a commander. Will pass `playerId` to `CommanderSearch` and use `useCommanderWhitelists`. |
| `app/components/events/modals/EventCommanderModal.vue` | Event-level wrapper. No logic changes; just passes props through. |
| `app/pages/player/[slug]/deck/[deckSlug].vue` | Deck detail page. Remove `fetchCardData` (Scryfall). Use `useCommanderCards` and DB fields. |
| `app/pages/deck/[deckSlug].vue` | Deck aggregate page. Fix `getArtCrop` import + `manaCost` property access. |
| `app/components/CommanderDeckCard.vue` | Deck card component. Already uses `useCommanderCards` / `getArtCrop`; verify after schema changes. |
| `shared/utils/types/database.ts` | Supabase-generated TypeScript types. Regenerate after schema changes. |

---

### Task 1: Extend `mtg_commanders` schema with missing image/back-face columns

**Files:**
- Modify: `supabase` (via SQL)

- [ ] **Step 1: Run SQL to add columns**

Use `supabase_execute_sql` (MCP) or `supabase db query` (CLI) to run this directly on the database:

```sql
ALTER TABLE mtg_commanders
ADD COLUMN IF NOT EXISTS is_double_faced boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS back_image_url text,
ADD COLUMN IF NOT EXISTS back_art_crop_url text,
ADD COLUMN IF NOT EXISTS back_oracle_text text,
ADD COLUMN IF NOT EXISTS back_mana_cost text,
ADD COLUMN IF NOT EXISTS back_type_line text,
ADD COLUMN IF NOT EXISTS large_image_url text,
ADD COLUMN IF NOT EXISTS back_large_image_url text;
```

- [ ] **Step 2: Verify columns were added**

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'mtg_commanders'
ORDER BY column_name;
```

Expected: the list must include `is_double_faced`, `back_image_url`, `back_art_crop_url`, `back_oracle_text`, `back_mana_cost`, `back_type_line`, `large_image_url`, `back_large_image_url`.

- [ ] **Step 3: Commit migration file (when ready)**

When all schema changes are stable, generate the migration:

```bash
supabase migration new add_commander_backface_columns
supabase db diff --local --use-migra -f add_commander_backface_columns
```

---

### Task 2: Update sync script to populate new columns

**Files:**
- Modify: `server/api/admin/sync-commanders.post.ts`

- [ ] **Step 1: Update the upsert payload mapping**

In the sync script, the `batch.map(card => ({ ... }))` block must include the new fields. Change the mapping to:

```ts
scryfall_id: card.id,
card_name: card.name,
image_url: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null,
large_image_url: card.image_uris?.large ?? card.card_faces?.[0]?.image_uris?.large ?? null,
art_crop_url: card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop ?? null,
back_image_url: card.card_faces?.[1]?.image_uris?.normal ?? null,
back_large_image_url: card.card_faces?.[1]?.image_uris?.large ?? null,
back_art_crop_url: card.card_faces?.[1]?.image_uris?.art_crop ?? null,
mana_cost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? null,
back_mana_cost: card.card_faces?.[1]?.mana_cost ?? null,
cmc: card.cmc ?? null,
color_identity: card.color_identity ?? [],
type_line: card.type_line ?? card.card_faces?.[0]?.type_line ?? null,
back_type_line: card.card_faces?.[1]?.type_line ?? null,
keywords: card.keywords ?? [],
oracle_text: card.oracle_text ?? card.card_faces?.[0]?.oracle_text ?? null,
back_oracle_text: card.card_faces?.[1]?.oracle_text ?? null,
partner_type: partnerType ?? null,
partner_group_tag: partnerGroupTag ?? null,
partner_with_scryfall_id: partnerWithId ?? null,
scryfall_url: card.scryfall_uri ?? null,
legalities: card.legalities ?? null,
released_at: card.released_at ?? null,
edhrec_rank: card.edhrec_rank ?? null,
is_double_faced: (card.card_faces?.length ?? 0) > 1,
last_synced_at: new Date().toISOString(),
```

- [ ] **Step 2: Re-run the sync script**

Hit the admin endpoint (or run the script locally) to re-populate all rows with the new fields.

```bash
curl -X POST http://localhost:3000/api/admin/sync-commanders
```

- [ ] **Step 3: Verify a double-faced card has back URLs**

Query the DB:

```sql
SELECT card_name, is_double_faced, back_image_url, back_large_image_url
FROM mtg_commanders
WHERE is_double_faced = true
LIMIT 5;
```

Expected: rows like "Delver of Secrets" have non-null `back_image_url` and `back_large_image_url`.

---

### Task 3: Regenerate Supabase TypeScript types

**Files:**
- Modify: `shared/utils/types/database.ts`

- [ ] **Step 1: Generate types**

```bash
npx supabase gen types typescript --project-id cnekayemkleqkwvxtlwp --schema public > shared/utils/types/database.ts
```

- [ ] **Step 2: Verify `mtg_commanders` Row type includes new columns**

Open `shared/utils/types/database.ts` and confirm `mtg_commanders.Row` has:
`is_double_faced`, `back_image_url`, `back_art_crop_url`, `back_oracle_text`, `back_mana_cost`, `back_type_line`, `large_image_url`, `back_large_image_url`.

---

### Task 4: Update `useCommanderCards.ts` schema, mapping, and `getArtCrop`

**Files:**
- Modify: `app/composables/useCommanderCards.ts`

- [ ] **Step 1: Add new fields to `CommanderCardSchema`**

Update the schema (after `releasedAt`):

```ts
const CommanderCardSchema = v.object({
  scryfallId: v.string(),
  scryfallUrl: v.nullable(v.string()),
  name: v.string(),
  imageUrl: v.nullable(v.string()),
  largeImageUrl: v.nullable(v.string()),
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
  isDoubleFaced: v.boolean(),
  backImageUrl: v.nullable(v.string()),
  backLargeImageUrl: v.nullable(v.string()),
  backArtCropUrl: v.nullable(v.string()),
  backOracleText: v.nullable(v.string()),
  backManaCost: v.nullable(v.string()),
  backTypeLine: v.nullable(v.string()),
})
```

- [ ] **Step 2: Update `mapToCommanderCard` to map new DB columns**

Add these mappings inside `mapToCommanderCard`:

```ts
largeImageUrl: row.large_image_url ?? null,
```

And at the end of the `raw` object:

```ts
isDoubleFaced: row.is_double_faced ?? false,
backImageUrl: row.back_image_url ?? null,
backLargeImageUrl: row.back_large_image_url ?? null,
backArtCropUrl: row.back_art_crop_url ?? null,
backOracleText: row.back_oracle_text ?? null,
backManaCost: row.back_mana_cost ?? null,
backTypeLine: row.back_type_line ?? null,
```

- [ ] **Step 3: Export `getArtCrop` helper**

Append at the bottom of the file:

```ts
export function getArtCrop(card: CommanderCard | null): string | null {
  return card?.artCropUrl ?? null
}
```

- [ ] **Step 4: Export `mapToCommanderCard` for reuse**

Change `function mapToCommanderCard` to `export function mapToCommanderCard`.

---

### Task 5: Create `useCommanderSearch.ts` composable

**Files:**
- Create: `app/composables/useCommanderSearch.ts`

- [ ] **Step 1: Write the composable**

```ts
// app/composables/useCommanderSearch.ts
import { mapToCommanderCard, type CommanderCard } from './useCommanderCards'

function parseManaCost(manaCost: string | null): string[] {
  if (!manaCost) return []
  return manaCost.match(/{[^}]+}/g) ?? []
}

export interface UseCommanderSearchOptions {
  whitelist?: string[] | null
  playerId?: number | null
}

export function useCommanderSearch(options: UseCommanderSearchOptions = {}) {
  const supabase = useSupabaseClient()
  const query = ref('')
  const suggestions = ref<string[]>([])
  const suggestionMeta = ref<Record<string, { tokens: string[] }>>({})
  const card = ref<CommanderCard | null>(null)
  const isLoading = ref(false)
  const showSuggestions = ref(false)
  const selectedIndex = ref(-1)

  async function fetchSuggestions(q: string) {
    isLoading.value = true
    try {
      const trimmed = q.trim().toLowerCase()
      let dbQuery = supabase
        .from('mtg_commanders')
        .select('card_name, mana_cost, edhrec_rank')

      if (trimmed.length >= 1) {
        dbQuery = dbQuery.ilike('card_name', `%${trimmed}%`)
      }

      if (options.whitelist && options.whitelist.length > 0) {
        dbQuery = dbQuery.in('card_name', options.whitelist)
      }

      const { data, error } = await dbQuery
        .order('edhrec_rank', { ascending: true })
        .limit(50)

      if (error || !data) {
        console.error('[useCommanderSearch] DB error:', error?.message)
        suggestions.value = []
        suggestionMeta.value = {}
        return
      }

      let result = data

      // If a playerId is provided, reorder: used commanders first, then by edhrec_rank
      if (options.playerId != null) {
        const { data: usedData, error: usedError } = await supabase
          .from('table_participants')
          .select('commander_1_name')
          .eq('player_id', options.playerId)

        if (!usedError && usedData) {
          const usedCounts = new Map<string, number>()
          for (const row of usedData) {
            const name = row.commander_1_name
            usedCounts.set(name, (usedCounts.get(name) ?? 0) + 1)
          }

          result = [...data].sort((a, b) => {
            const aCount = usedCounts.get(a.card_name) ?? 0
            const bCount = usedCounts.get(b.card_name) ?? 0
            if (aCount !== bCount) return bCount - aCount
            return (a.edhrec_rank ?? 999999) - (b.edhrec_rank ?? 999999)
          })
        }
      }

      suggestions.value = result.map(r => r.card_name)
      suggestionMeta.value = Object.fromEntries(
        result.map(r => [r.card_name, { tokens: parseManaCost(r.mana_cost) }])
      )
    } finally {
      isLoading.value = false
    }
  }

  async function handleSelect(name: string) {
    const { data, error } = await supabase
      .from('mtg_commanders')
      .select('*')
      .eq('card_name', name)
      .single()

    if (error || !data) {
      console.error(`[useCommanderSearch] Card not found: "${name}"`, error?.message)
      card.value = null
      return
    }

    try {
      card.value = mapToCommanderCard(data)
    } catch (err) {
      console.error(`[useCommanderSearch] Validation error for "${name}":`, err)
      card.value = null
    }
  }

  function navigateSuggestions(direction: 'up' | 'down') {
    if (suggestions.value.length === 0) return
    if (direction === 'down') {
      selectedIndex.value = (selectedIndex.value + 1) % suggestions.value.length
    } else {
      selectedIndex.value = selectedIndex.value <= 0
        ? suggestions.value.length - 1
        : selectedIndex.value - 1
    }
  }

  function selectCurrent() {
    if (selectedIndex.value >= 0 && selectedIndex.value < suggestions.value.length) {
      const name = suggestions.value[selectedIndex.value]
      query.value = name
      handleSelect(name)
      showSuggestions.value = false
    }
  }

  function closeSuggestions() {
    showSuggestions.value = false
    selectedIndex.value = -1
  }

  const debouncedFetch = useDebounceFn((q: string) => {
    fetchSuggestions(q)
  }, 150)

  watch(query, (newQuery) => {
    selectedIndex.value = -1
    if (newQuery.length === 0) {
      suggestions.value = []
      suggestionMeta.value = {}
      showSuggestions.value = false
      return
    }
    showSuggestions.value = true
    debouncedFetch(newQuery)
  })

  return {
    query,
    suggestions,
    showSuggestions,
    selectedIndex,
    isLoading,
    handleSelect,
    card,
    suggestionMeta,
    navigateSuggestions,
    selectCurrent,
    closeSuggestions,
  }
}
```

- [ ] **Step 2: Verify the composable compiles**

Open `app/composables/useCommanderSearch.ts` in your editor and confirm there are no TypeScript errors (e.g., missing imports from `useCommanderCards`).

---

### Task 6: Update `CommanderSearch.vue` to use `useCommanderSearch`

**Files:**
- Modify: `app/components/CommanderSearch.vue`

- [ ] **Step 1: Add `playerId` prop**

Change the props definition to:

```ts
const props = defineProps<{
  modelValue?: string | null
  whitelist?: string[] | null
  playerId?: number | null
}>()
```

- [ ] **Step 2: Replace `useCardSearch` with `useCommanderSearch`**

Replace the `useCardSearch` import block with:

```ts
const {
  query,
  suggestions,
  showSuggestions,
  selectedIndex,
  isLoading,
  handleSelect,
  card,
  suggestionMeta,
  navigateSuggestions,
  selectCurrent,
  closeSuggestions,
} = useCommanderSearch({
  whitelist: props.whitelist,
  playerId: props.playerId,
})
```

- [ ] **Step 3: Remove the `watch(localValue, ...)` assignment that also sets `query.value`**

In `CommanderSearch.vue`, `localValue` is a two-way binding for the input text. The `watch(localValue, ...)` currently does `emit + query.value = newValue`. That is fine; keep it. But remove any duplicated `query.value` assignments (the current code has `query.value = newValue` inside `watch(localValue)` and also inside `watch(() => props.modelValue)`). Keep only the `watch(localValue)` one.

---

### Task 7: Update `CommanderModal.vue` to pass `playerId` and use new whitelists

**Files:**
- Modify: `app/components/modals/CommanderModal.vue`

- [ ] **Step 1: Replace `useCardWhitelists` with `useCommanderWhitelists`**

Change the import and usage:

```ts
const { whitelists, isLoading, loadAllLists } = useCommanderWhitelists()
```

- [ ] **Step 2: Pass `playerId` to `CommanderSearch`**

In the template, update the `<CommanderSearch>` call:

```vue
<CommanderSearch
  v-model="commander1"
  :whitelist="commanderWhitelist"
  :player-id="props.playerId"
/>
```

---

### Task 8: Create `useCommanderWhitelists.ts` to replace `useCardWhitelists`

**Files:**
- Create: `app/composables/useCommanderWhitelists.ts`

- [ ] **Step 1: Write the composable**

```ts
// app/composables/useCommanderWhitelists.ts

export function useCommanderWhitelists() {
  const whitelists = ref({
    commander: [] as string[],
    partner: [] as string[],
    partnerWith: [] as string[],
    background: [] as string[],
    doctorsCompanion: [] as string[],
    companion: [] as string[],
    friendForever: [] as string[],
  })

  const isLoading = ref(true)

  async function loadAllLists() {
    const supabase = useSupabaseClient()
    isLoading.value = true

    try {
      const { data, error } = await supabase
        .from('mtg_commanders')
        .select('card_name, partner_type, keywords')

      if (error || !data) {
        console.error('[useCommanderWhitelists] Error fetching commanders:', error?.message)
        return
      }

      // Reset
      whitelists.value.commander = []
      whitelists.value.partner = []
      whitelists.value.partnerWith = []
      whitelists.value.background = []
      whitelists.value.doctorsCompanion = []
      whitelists.value.companion = []
      whitelists.value.friendForever = []

      for (const row of data) {
        const name = row.card_name
        whitelists.value.commander.push(name)

        switch (row.partner_type) {
          case 'partner':
            whitelists.value.partner.push(name)
            break
          case 'partner_with':
            whitelists.value.partnerWith.push(name)
            break
          case 'background':
          case 'background_commander':
            whitelists.value.background.push(name)
            break
          case 'doctors_companion':
            whitelists.value.doctorsCompanion.push(name)
            break
          case 'friends_forever':
            whitelists.value.friendForever.push(name)
            break
        }

        if (row.keywords?.includes('Companion')) {
          whitelists.value.companion.push(name)
        }
      }
    } finally {
      isLoading.value = false
    }
  }

  return {
    whitelists: readonly(whitelists),
    isLoading: readonly(isLoading),
    loadAllLists,
  }
}
```

---

### Task 9: Update `CardPreview.vue` to accept `CommanderCard`

**Files:**
- Modify: `app/components/CardPreview.vue`

- [ ] **Step 1: Replace `ScryfallCard` with `CommanderCard`**

Remove the old interfaces and import `CommanderCard`:

```ts
import type { CommanderCard } from '~/composables/useCommanderCards'
```

Change props to:

```ts
const props = defineProps<{
  card: CommanderCard | null
}>()
```

- [ ] **Step 2: Simplify color resolution**

Replace `resolveDoubleFacedColors`, `resolveSingleFacedColors`, and `resolveCardColors` with:

```ts
function resolveCardColors(card: CommanderCard): string[] {
  const colors = new Set<string>()

  if (card.manaCost) {
    extractColorsFromManaCost(card.manaCost).forEach(c => colors.add(c))
  }

  if (card.isDoubleFaced && card.backManaCost) {
    extractColorsFromManaCost(card.backManaCost).forEach(c => colors.add(c))
  }

  if (colors.size === 0 && card.colorIdentity?.length) {
    card.colorIdentity.forEach(c => colors.add(c))
  }

  if (colors.size === 0) return ['C']
  return Array.from(colors)
}
```

- [ ] **Step 3: Update image computed properties**

```ts
const isDoubleFaced = computed(() => props.card?.isDoubleFaced ?? false)

const frontImage = computed(() => props.card?.largeImageUrl ?? null)

const backImage = computed(() => {
  if (!isDoubleFaced.value) return null
  return props.card?.backLargeImageUrl ?? null
})
```

- [ ] **Step 4: Remove the old `watch` logging block if desired**

The `watch(() => props.card, ...)` block can stay or be removed; it does not affect functionality.

---

### Task 10: Update `player/[slug]/deck/[deckSlug].vue` to use DB data only

**Files:**
- Modify: `app/pages/player/[slug]/deck/[deckSlug].vue`

- [ ] **Step 1: Remove Scryfall `fetchCardData` and `ScryfallCard` interface**

Delete the entire `ScryfallCard` interface and the `fetchCardData` function.

- [ ] **Step 2: Import and use `useCommanderCards`**

Add at the top:

```ts
import { useCommanderCards } from '~/composables/useCommanderCards'
```

Replace the `cardData` / `cardLoading` / `fetchCardData` logic with:

```ts
const { commander1Data, commander2Data, loading: cardLoading, fetchAllData } = useCommanderCards(
  computed(() => deck.value?.commander_1_name ?? null),
  computed(() => deck.value?.commander_2_name ?? null)
)
```

- [ ] **Step 3: Replace image lookups with DB fields**

Replace:

```ts
const card1 = computed(() => {
  if (cardData.value?.card_faces?.[0]?.image_uris?.normal) {
    return cardData.value.card_faces[0].image_uris.normal
  }
  return cardData.value?.image_uris?.normal || null
})
```

With:

```ts
const card1 = computed(() => commander1Data.value?.imageUrl ?? null)
const card2 = computed(() => commander2Data.value?.imageUrl ?? null)
```

- [ ] **Step 4: Fix `ManaCost` prop access**

In the template, change `commander1Data?.mana_cost` to `commander1Data?.manaCost` and `commander2Data?.mana_cost` to `commander2Data?.manaCost`.

- [ ] **Step 5: Update `deckDisplayName` computed**

It should stay the same (it reads from `deck.value`).

---

### Task 11: Fix `deck/[deckSlug].vue` property access

**Files:**
- Modify: `app/pages/deck/[deckSlug].vue`

- [ ] **Step 1: Fix `ManaCost` prop access**

In the template, change `commander1Data?.mana_cost` to `commander1Data?.manaCost`.

- [ ] **Step 2: Verify `getArtCrop` is imported correctly**

The file already does `import { getArtCrop, useCommanderCards } from '~/composables/useCommanderCards'`. After Task 4 this import will be valid.

---

### Task 12: Remove dead `useCardSearch.ts` and `useCardWhitelists.ts`

**Files:**
- Delete: `app/composables/useCardSearch.ts`
- Delete: `app/composables/useCardWhitelists.ts`

- [ ] **Step 1: Verify no remaining imports**

Search the codebase for `useCardSearch` and `useCardWhitelists`:

```bash
grep -r "useCardSearch\|useCardWhitelists" app/ shared/
```

Expected: no matches outside the files being deleted.

- [ ] **Step 2: Delete the files**

```bash
rm app/composables/useCardSearch.ts
rm app/composables/useCardWhitelists.ts
```

---

### Task 13: Final verification — no runtime Scryfall calls for commander data

**Files:**
- All `.vue` and `.ts` files in `app/`

- [ ] **Step 1: Search for remaining Scryfall API calls**

```bash
grep -r "api.scryfall.com" app/
```

Expected: only `server/api/admin/sync-commanders.post.ts` should match. All other matches must be removed.

- [ ] **Step 2: Search for remaining `scryfall.com` hardlinks in commander UI**

```bash
grep -r "scryfall.com" app/
```

Expected: only `scryfallSearchUrl` computed properties (which link to the Scryfall search page) are acceptable. No image URLs should point to `scryfall.com` except those stored in the DB (`image_url`, `large_image_url`, etc.).

- [ ] **Step 3: Run the dev server and test the commander modal**

1. Open an event page.
2. Click to assign a commander to a player.
3. Type a commander name in the search box.
4. Confirm suggestions appear without any network calls to `api.scryfall.com`.
5. Select a double-faced commander (e.g., "Delver of Secrets") and confirm both faces appear in `CardPreview`.
6. Re-open the modal for the same player; confirm their previously used commanders appear at the top of the suggestion list.

---

## Self-Review Checklist

1. **Spec coverage:**
   - [x] DB schema extended with back-face/large image columns — Task 1
   - [x] Sync script populates new columns — Task 2
   - [x] Types regenerated — Task 3
   - [x] `useCommanderCards` schema updated + `getArtCrop` exported — Task 4
   - [x] New `useCommanderSearch` replaces `useCardSearch` — Task 5
   - [x] `CommanderSearch.vue` uses new composable + passes `playerId` — Task 6
   - [x] `CommanderModal.vue` passes `playerId` + uses new whitelists — Task 7
   - [x] `useCommanderWhitelists` replaces `useCardWhitelists` — Task 8
   - [x] `CardPreview.vue` uses `CommanderCard` + DB fields — Task 9
   - [x] `player/[slug]/deck/[deckSlug].vue` uses `useCommanderCards` — Task 10
   - [x] `deck/[deckSlug].vue` property access fixed — Task 11
   - [x] Dead composables removed — Task 12
   - [x] No runtime Scryfall calls remain — Task 13

2. **Placeholder scan:** No TBD / TODO / "implement later" / "add error handling" found.

3. **Type consistency:** `CommanderCard` fields are camelCase (`manaCost`, `largeImageUrl`, `isDoubleFaced`, etc.) everywhere. DB columns are snake_case. `mapToCommanderCard` is the single mapping point.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-29-full-scryfall-to-supabase-migration.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

**Which approach?**
