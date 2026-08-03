<!-- app\components\commander\CommanderVoteCard.vue -->
<script setup lang="ts">
const {
  commanderName,
  name,
  surname,
  avatarUrl,
  playerId,
  selected = false,
  tabindex = 0,
} = defineProps<{
  commanderName: string | null
  name: string
  surname: string
  avatarUrl?: string
  playerId?: number
  selected?: boolean
  /** Roving tabindex (see docs/architecture or coding-knowledge-base "modals.md"-adjacent
   *  note on grid arrow-key nav) — the parent keeps exactly one card at 0, the rest at -1. */
  tabindex?: number
}>()

const emit = defineEmits<{
  click: []
  /** Player has no commander recorded yet — the whole card acts as this link instead of a vote-select. */
  assign: []
  /** Arrow/Home/End pressed — parent owns the sibling list, so it resolves the target and calls focus(). */
  navigate: [direction: 'next' | 'prev' | 'first' | 'last']
}>()

const { t } = useI18n()

// Self-contained like CommanderDeckCard.vue: reads the already-cached
// (30-day) commander catalog — the same one CommanderSearch autocompletes
// against — instead of requiring the caller to resolve art/mana cost itself.
const { data: catalog, isLoading } = useCommanderCatalogQuery()
const commanderRow = computed(() => catalog.value?.find(row => row.name === commanderName) ?? null)

// Voting for a deck you can't even name doesn't make sense — until a
// commander is on record, the whole card is the "go assign one" action
// instead of a (meaningless) vote target.
function onActivate() {
  if (commanderName) emit('click')
  else emit('assign')
}

const NAVIGATE_KEYS: Record<string, 'next' | 'prev' | 'first' | 'last'> = {
  ArrowRight: 'next',
  ArrowDown: 'next',
  ArrowLeft: 'prev',
  ArrowUp: 'prev',
  Home: 'first',
  End: 'last',
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onActivate()
    return
  }
  const direction = NAVIGATE_KEYS[event.key]
  if (!direction) return
  event.preventDefault()
  emit('navigate', direction)
}

const rootEl = useTemplateRef<HTMLDivElement>('rootEl')
defineExpose({ focus: () => rootEl.value?.focus() })
</script>

<template>
  <div
    ref="rootEl"
    class="cursor-pointer transition-all rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary"
    :class="commanderName
      ? (selected ? 'ring-4 ring-primary' : 'hover:ring-2 hover:ring-default')
      : 'hover:ring-2 hover:ring-warning'"
    :tabindex="tabindex"
    role="button"
    :aria-pressed="commanderName ? selected : undefined"
    :aria-label="commanderName
      ? `${name} ${surname} — ${commanderName}`
      : `${t('commander.voteCard.assignCommander')} — ${name} ${surname}`"
    @click="onActivate"
    @keydown="onKeydown"
  >
    <UCard class="overflow-hidden" :ui="{ body: 'p-0 sm:p-0', footer: 'px-2.5 py-2' }">
      <div class="aspect-4/3 bg-muted">
        <CommanderArt
          v-if="commanderName"
          :card-name="commanderName"
          :art-url="commanderRow?.artCropUrl ?? null"
          :mana-cost="commanderRow?.manaCost ?? undefined"
          :loading="isLoading"
          size="sm"
        />
        <div v-else class="h-full w-full flex flex-col items-center justify-center gap-1.5 p-2 text-warning">
          <UAvatar
            size="lg"
            :src="avatarUrl || generatePlayerAvatar(playerId ?? `${name} ${surname}`)"
            :alt="name"
          />
          <span class="flex items-center gap-1 text-xs font-medium">
            <UIcon :name="ICONS.commander" class="size-4" />
            {{ t('commander.voteCard.assignCommander') }}
          </span>
        </div>
      </div>
      <template #footer>
        <div class="flex items-center gap-2">
          <PlayerNameTag
            :name="name"
            :surname="surname"
            :avatar-url="avatarUrl"
            :player-id="playerId"
            :linkable="false"
            wrap
            class="min-w-0"
          />
          <UIcon v-if="selected" :name="ICONS.success" class="ms-auto text-primary size-5 shrink-0" />
        </div>
      </template>
    </UCard>
  </div>
</template>
