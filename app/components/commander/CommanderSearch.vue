<!-- app\components\commander\CommanderSearch.vue -->
<script setup lang="ts">
const props = defineProps<{
  whitelist?: string[] | null
  playerId?: number | null
  /** Every player seated at the same table/round — see useCommanderSearch's
   *  `tablePlayerIds` option for why this is worth passing. */
  tablePlayerIds?: number[]
}>()

const modelValue = defineModel<string | null>()

// Captured once at mount, not reactive: a commander already set (modal
// reopened on an existing entry) shouldn't yank focus/pop the dropdown open
// on top of the illustration the user just wanted to see — only an empty
// field (adding a new commander) should.
const hadInitialValue = !!modelValue.value

const { t } = useI18n()

const {
  query,
  suggestionGroups,
  isLoading,
  handleSelect,
  card,
} = useCommanderSearch({
  whitelist: () => props.whitelist,
  playerId: () => props.playerId,
  tablePlayerIds: () => props.tablePlayerIds ?? [],
})

// USelectMenu's modelValue is `string | undefined` (labelKey values aren't
// nullable) — bridge to the component's `string | null` external contract.
const selected = computed({
  get: () => modelValue.value ?? undefined,
  set: (v: string | undefined) => { modelValue.value = v ?? null }
})

// Fetches the full card (for CardPreview) whenever a commander is picked —
// separate from `query`, which is only the search-box text (USelectMenu shows
// the selected value in its own trigger button, not in the search input).
watch(modelValue, (name) => {
  if (name) handleSelect(name)
}, { immediate: true })
</script>

<template>
  <div>
    <USelectMenu
      v-model="selected"
      v-model:search-term="query"
      :items="suggestionGroups"
      ignore-filter
      value-key="label"
      :loading="isLoading"
      :placeholder="t('commander.searchPlaceholder')"
      :default-open="!hadInitialValue"
      :autofocus="!hadInitialValue"
      class="w-full"
      :ui="{ content: 'max-h-96' }"
    >
      <template #item-label="{ item }">
        <UTooltip
          :disabled="!item.imageUrl"
          :delay-duration="200"
          :ui="{ content: 'p-1' }"
        >
          <span class="flex items-center gap-2 min-w-0">
            <span
              v-if="item.tokens?.length"
              class="shrink-0 bg-gray-950 p-1 rounded"
            >
              <ManaCost :mana-cost="item.tokens.join('')" size="sm" />
            </span>
            <span class="truncate">
              <component :is="() => highlightFuzzyChars(item.label, item.matchIndices ?? [])" />
            </span>
          </span>

          <template
            v-if="item.imageUrl"
            #content
          >
            <img
              :src="item.imageUrl"
              :alt="item.label"
              class="w-48 rounded"
            >
          </template>
        </UTooltip>
      </template>
    </USelectMenu>

    <!-- Preview of the selected card -->
    <CardPreview :card="card" />
  </div>
</template>
