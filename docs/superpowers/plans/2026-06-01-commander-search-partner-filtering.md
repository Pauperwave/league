# Commander Search with Auto-Detect Partner Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the commander search on the event page by adding commander2 support with auto-detected partner/background filtering based on commander1 selection.

**Architecture:** Extend the existing `CommanderModal` component to support two commander slots. When commander1 is selected, auto-detect its `partner_type` from the whitelist data and restrict commander2 search to only compatible partners. Keep all filtering client-side using the already-loaded whitelist categories.

**Tech Stack:** Vue 3, Nuxt 3, Pinia, Supabase, Tailwind CSS, Nuxt UI

---

## Task 1: Extend `useCommanderWhitelists` with Partner Type Lookup

**Files:**
- Modify: `app/composables/commanders/useCommanderWhitelists.ts`

**Context:** The whitelist composable already loads all 2,986 commanders and categorizes them by `partner_type`. We need to expose two new lookup functions: one to get a card's `partner_type` by name, and one to get the allowed partner category for a given `partner_type`.

- [ ] **Step 1: Add partner type lookup maps**

Add two new refs to store the lookup maps:

```typescript
const partnerTypeByName = ref<Map<string, string>>(new Map())
const partnerWithMap = ref<Map<string, string>>(new Map()) // name -> partner_with_name
```

- [ ] **Step 2: Populate lookup maps during `loadAllLists`**

Inside the `for (const row of data)` loop, add:

```typescript
partnerTypeByName.value.set(name, row.partner_type || 'commander')

if (row.partner_type === 'partner_with' && row.partner_with_scryfall_id) {
  // Store the scryfall ID for later resolution
  partnerWithMap.value.set(name, row.partner_with_scryfall_id)
}
```

- [ ] **Step 3: Add lookup functions**

Add these exported functions before the return statement:

```typescript
/**
 * Get the partner_type for a given commander name.
 * Returns 'commander' for normal commanders, or the specific type.
 */
function getPartnerType(cardName: string): string {
  return partnerTypeByName.value.get(cardName) || 'commander'
}

/**
 * Given a commander1 name, return the list of allowed commander2 names.
 * Returns empty array if commander1 cannot have a partner.
 */
function getAllowedPartners(commander1Name: string): string[] {
  const type = getPartnerType(commander1Name)

  switch (type) {
    case 'partner':
      return [...whitelists.value.partner]
    case 'partner_with':
      // For "partner with", only the specific matching partner is allowed
      // We need to find the card with the matching partner_with_scryfall_id
      // This requires the full card data, which we don't have here
      // For now, return all partnerWith cards and let the user pick
      return [...whitelists.value.partnerWith]
    case 'background':
    case 'background_commander':
      return [...whitelists.value.background]
    case 'friends_forever':
      return [...whitelists.value.friendForever]
    case 'doctors_companion':
      return [...whitelists.value.doctorsCompanion]
    case 'companion':
      return [...whitelists.value.companion]
    case 'commander':
    default:
      return []
  }
}
```

- [ ] **Step 4: Update return object**

Expose the new functions:

```typescript
return {
  whitelists: readonly(whitelists),
  isLoading: readonly(isLoading),
  loadAllLists,
  getPartnerType,
  getAllowedPartners,
}
```

- [ ] **Step 5: Verify TypeScript**

Run: `npx nuxt typecheck`
Expected: 0 errors

---

## Task 2: Extend `CommanderModal.vue` to Support Commander2

**Files:**
- Modify: `app/components/commander/CommanderModal.vue`

**Context:** The modal currently only has a single `CommanderSearch` for commander1. We need to add a second search for commander2 that is dynamically enabled/disabled based on commander1's partner type. The modal should also pass the appropriate whitelist to commander2 search.

- [ ] **Step 1: Update props**

Change props to accept `commander2`:

```typescript
const props = defineProps<{
  playerId: number
  playerName: string
  commander1?: string | null
  commander2?: string | null
}>()
```

- [ ] **Step 2: Update emits**

Change emit to include commander2:

```typescript
const emit = defineEmits<{
  submit: [commander1: string | null, commander2: string | null]
  cancel: []
}>()
```

- [ ] **Step 3: Add commander2 state and partner type detection**

Add after existing refs:

```typescript
const commander2 = ref(props.commander2 || '')
const { whitelists, isLoading, loadAllLists, getPartnerType, getAllowedPartners } = useCommanderWhitelists()

// Computed: what partner type does commander1 have?
const commander1PartnerType = computed(() => {
  if (!commander1.value) return null
  return getPartnerType(commander1.value)
})

// Computed: should commander2 be enabled?
const canHaveCommander2 = computed(() => {
  return commander1PartnerType.value !== null && commander1PartnerType.value !== 'commander'
})

// Computed: whitelist for commander2 based on commander1's partner type
const commander2Whitelist = computed(() => {
  if (!commander1.value || !canHaveCommander2.value) return []
  return getAllowedPartners(commander1.value)
})

// Computed: label text for commander2 field
const commander2Label = computed(() => {
  const type = commander1PartnerType.value
  if (!type || type === 'commander') return 'Comandante 2 (non disponibile)'
  if (type === 'partner') return 'Partner'
  if (type === 'partner_with') return 'Partner With'
  if (type === 'background' || type === 'background_commander') return 'Background'
  if (type === 'friends_forever') return 'Friends Forever'
  if (type === 'doctors_companion') return 'Doctor\'s Companion'
  if (type === 'companion') return 'Companion'
  return 'Comandante 2'
})
```

- [ ] **Step 4: Watch for commander1 changes to clear commander2**

Add a watcher to clear commander2 when commander1 changes:

```typescript
watch(() => props.commander1, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    commander2.value = ''
  }
})
```

- [ ] **Step 5: Update template with second commander slot**

Replace the template with:

```vue
<template>
  <div class="space-y-4">
    <!-- Commander 1 -->
    <div>
      <label class="block text-sm font-medium mb-1">Comandante</label>
      <div v-if="isLoading" class="text-sm text-gray-500 mb-2">
        Caricamento liste carte...
      </div>
      <CommanderSearch
        v-model="commander1"
        :player-id="props.playerId"
      />
    </div>

    <!-- Commander 2 (conditional) -->
    <div v-if="canHaveCommander2">
      <label class="block text-sm font-medium mb-1">{{ commander2Label }}</label>
      <UBadge
        v-if="commander2Whitelist.length > 0"
        size="sm"
        color="info"
        variant="soft"
        class="mb-2"
      >
        {{ commander2Whitelist.length }} carte compatibili
      </UBadge>
      <CommanderSearch
        v-model="commander2"
        :whitelist="commander2Whitelist"
        :player-id="props.playerId"
      />
    </div>
    <div v-else-if="commander1" class="text-sm text-gray-500">
      Questo comandante non supporta un secondo comandante
    </div>
  </div>
</template>
```

- [ ] **Step 6: Update submit function**

Change submit to pass both commanders:

```typescript
function submit() {
  emit('submit', commander1.value || null, commander2.value || null)
}
```

- [ ] **Step 7: Verify TypeScript**

Run: `npx nuxt typecheck`
Expected: 0 errors

---

## Task 3: Update `EventCommanderModal.vue` to Pass Commander2

**Files:**
- Modify: `app/components/event/modal/EventCommanderModal.vue`

**Context:** The event wrapper needs to pass the current commander2 from the store to CommanderModal, and forward the submit event with both commanders.

- [ ] **Step 1: Update props**

No prop changes needed - `commandersStore` already provides access to `getCommander2`.

- [ ] **Step 2: Update emit signature**

Change the emit type:

```typescript
const emit = defineEmits<{
  submit: [commander1: string | null, commander2: string | null]
  cancel: []
}>()
```

- [ ] **Step 3: Update CommanderModal binding**

Update the `CommanderModal` component call to pass commander2 and forward the submit event:

```vue
<CommanderModal
  v-if="selectedPlayerId"
  ref="commanderModalRef"
  :player-id="selectedPlayerId"
  :player-name="getPlayerName(selectedPlayerId)"
  :commander1="commandersStore.getCommander1(selectedPlayerId)"
  :commander2="commandersStore.getCommander2(selectedPlayerId)"
  @submit="(cmd1, cmd2) => emit('submit', cmd1, cmd2)"
  @cancel="emit('cancel')"
/>
```

- [ ] **Step 4: Verify TypeScript**

Run: `npx nuxt typecheck`
Expected: 0 errors

---

## Task 4: Update `useEventSubmitHandlers.ts` for Dual Commander Submit

**Files:**
- Modify: `app/composables/event/useEventSubmitHandlers.ts`

**Context:** The submit handler currently only receives commander1. We need to update it to receive both commander1 and commander2, save both to the store, and call the event store with both.

- [ ] **Step 1: Update handleCommanderSubmit signature**

Change the function signature:

```typescript
function handleCommanderSubmit(commander1: string | null, commander2: string | null) {
```

- [ ] **Step 2: Update store and event store calls**

Replace the body with:

```typescript
  if (selectedPlayerId.value !== null && selectedCommanderPairingId.value !== null) {
    commandersStore.setCommanders(selectedPlayerId.value, commander1, commander2)
    toast.add({ title: 'Comandanti salvati', color: 'success' })
    eventStore.saveCommander(selectedCommanderPairingId.value, selectedPlayerId.value, commander1, commander2)
      .then(result => {
        if (!result.success) toast.add({ title: 'Errore', description: result.error, color: 'error' })
      })
  }
  return true
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx nuxt typecheck`
Expected: 0 errors (may show error about saveCommander signature until Task 5 is done)

---

## Task 5: Update `events.ts` saveCommander to Accept Commander2

**Files:**
- Modify: `app/stores/events.ts` (line 1054)

**Context:** The `saveCommander` function currently hardcodes `commander_2: null`. We need to make it accept commander2 as a parameter.

- [ ] **Step 1: Update function signature**

Change:

```typescript
async function saveCommander(pairingId: number, playerId: number, commander1: string | null, commander2: string | null = null): Promise<{ success: boolean; error?: string }> {
```

- [ ] **Step 2: Update upsert call**

Change:

```typescript
const result = await upsertRoundResult(pairingId, playerId, { commander_1: commander1, commander_2: commander2 })
```

- [ ] **Step 3: Update return object**

Ensure `saveCommander` is included in the store's return object (it already is at line 1240).

- [ ] **Step 4: Verify TypeScript**

Run: `npx nuxt typecheck`
Expected: 0 errors

---

## Task 6: Update Event Page to Handle Dual Commander Submit

**Files:**
- Modify: `app/pages/league/[leagueId]/event/[eventId].vue` (line 574-583)

**Context:** The event page currently passes `handleCommanderSubmit` which expects 1 argument. We need to update the EventCommanderModal binding to handle the new 2-argument submit.

- [ ] **Step 1: Verify EventCommanderModal usage**

The current binding is:

```vue
<EventCommanderModal
  :show-commander-modal="showCommanderModal"
  :selected-player-id="selectedPlayerId"
  :selected-commander-pairing-id="selectedCommanderPairingId"
  :commander-modal-ref="commanderModalRef"
  :get-player-name="getPlayerName"
  :commanders-store="commandersStore"
  @submit="submitHandlers.handleCommanderSubmit"
  @cancel="showCommanderModal = false"
/>
```

Since `@submit="submitHandlers.handleCommanderSubmit"` passes the event arguments directly, and we've updated `handleCommanderSubmit` to accept `(commander1, commander2)`, this should work without changes. The event emitter in `EventCommanderModal` already emits both values.

No changes needed here unless TypeScript complains.

- [ ] **Step 2: Verify TypeScript**

Run: `npx nuxt typecheck`
Expected: 0 errors

---

## Task 7: Optimize Commander1 Search by Removing Redundant Whitelist

**Files:**
- Modify: `app/components/commander/CommanderModal.vue`

**Context:** Currently, `CommanderModal.vue` passes `commanderWhitelist` (all 2,986 commander names) to `CommanderSearch.vue` for commander1. Since the whitelist is ALL cards, this `.in('card_name', whitelist)` filter in the DB query does nothing useful and adds overhead. We should remove this redundant whitelist for commander1.

- [ ] **Step 1: Remove whitelist prop from commander1 search**

In `CommanderModal.vue`, change the first `CommanderSearch` to not pass whitelist:

```vue
<CommanderSearch
  v-model="commander1"
  :player-id="props.playerId"
/>
```

- [ ] **Step 2: Remove commanderWhitelist computed**

Remove:

```typescript
const commanderWhitelist = computed(() => [...whitelists.value.commander])
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx nuxt typecheck`
Expected: 0 errors

---

## Task 8: Final Integration Test

**Files:**
- All modified files

- [ ] **Step 1: Run full TypeScript check**

Run: `npx nuxt typecheck`
Expected: 0 errors across all files

- [ ] **Step 2: Verify build**

Run: `npx nuxt build`
Expected: Successful build with no errors

- [ ] **Step 3: Commit changes**

```bash
git add app/composables/commanders/useCommanderWhitelists.ts
git add app/components/commander/CommanderModal.vue
git add app/components/event/modal/EventCommanderModal.vue
git add app/composables/event/useEventSubmitHandlers.ts
git add app/stores/events.ts
git commit -m "feat(commanders): add commander2 support with auto-detect partner filtering"
```

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| Optimize commander1 search | Task 7 |
| Add commander2 UI support | Task 2 |
| Auto-detect partner type from commander1 | Task 1, Task 2 |
| Client-side whitelist filtering for commander2 | Task 1, Task 2 |
| Update submit handlers for dual commanders | Task 3, Task 4, Task 5 |

No gaps identified.
