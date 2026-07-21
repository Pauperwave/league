<!-- app\components\commander\CommanderDeckCard.vue -->
 <script setup lang="ts">
import type { CommanderDeck, CommanderAggregate } from '#shared/utils/types'

const { t } = useI18n()

const props = defineProps<{
  deck: CommanderDeck
  playerSlug?: string
  eventCount?: number
  showActions?: boolean
  /** Aggregate stats (player count, match count) for /decks browse view */
  aggregate?: CommanderAggregate
}>()

const emit = defineEmits<{
  edit: [deck: CommanderDeck]
  delete: [deck: CommanderDeck]
}>()

// Colada cache of all players (ADR-015) — shared, no refetch
const { data: playersData } = usePlayersQuery()

/** True when showing in aggregate mode (no specific player context) */
const isAggregate = computed(() => !props.playerSlug)

const lenderName = computed(() => {
  if (!props.deck.is_borrowed || !props.deck.lender_id) return null
  const lender = (playersData.value ?? []).find(p => p.player_id === props.deck.lender_id)
  return lender ? t('deck.lentBy', { name: `${lender.player_name} ${lender.player_surname}` }) : null
})

const hasCompanion = computed(() => !!props.deck.companion_name)
const isUsedInEvents = computed(() => !!props.eventCount && props.eventCount > 0)

const scryfallSearchUrl = computed(() =>
  `https://scryfall.com/search?q=!"${encodeURIComponent(props.deck.commander_1_name)}"`
)

const statsPageUrl = computed(() => {
  if (isAggregate.value) {
    return `/deck/${slugify(props.deck.commander_1_name)}`
  }
  return `/player/${props.playerSlug}/deck/${slugify(props.deck.commander_1_name)}`
})

const { commander1Data, commander2Data, loading } = useCommanderCards(
  () => props.deck.commander_1_name,
  () => props.deck.commander_2_name
)

const art1 = computed(() => getArtCrop(commander1Data.value))
const art2 = computed(() => getArtCrop(commander2Data.value))

const eventCountLabel = computed(() =>
  isUsedInEvents.value
    ? t('deck.usedInEvents', props.eventCount!, { named: { count: props.eventCount } })
    : t('deck.notUsedInEvents')
)

// Bracket level (BACKLOG, 2026-07-22): self-assigned per player's own copy of
// a deck, so it's meaningless in aggregate mode (no single owning player).
const showBracketModal = ref(false)
const bracketChipLogging = useButtonLogging('Open Bracket Picker', { deckId: () => props.deck.id })
const toast = useToast()
const { updateDeck } = useDeckMutations()

const bracketDefinition = computed(() =>
  props.deck.bracket_level ? BRACKET_LEVELS[props.deck.bracket_level - 1] : null
)
const bracketChipLabel = computed(() => {
  const def = bracketDefinition.value
  return def
    ? t('deck.bracket.chipSet', { level: def.level, name: t(def.nameKey) })
    : t('deck.bracket.chipUnset')
})

function openBracketPicker() {
  bracketChipLogging.logClick()
  showBracketModal.value = true
}

async function onBracketConfirm(level: number) {
  try {
    await updateDeck.mutateAsync({ id: props.deck.id, updates: { bracket_level: level } })
  } catch (err) {
    toast.add({ title: t('deck.bracket.saveError'), description: toErrorMessage(err), color: 'error' })
    return
  }
  toast.add({ title: t('deck.bracket.saveSuccess'), color: 'success' })
}
</script>

<template>
  <UCard class="overflow-hidden hover:shadow-lg transition-shadow">
    <template #header>
      <div class="flex justify-end items-center gap-2 shrink-0">
        <!-- Aggregate badges (player count, match count) -->
        <template v-if="isAggregate && aggregate">
          <UBadge
            v-if="aggregate.player_count > 0"
            size="xs"
            variant="soft"
            color="info"
            class="flex items-center gap-1"
          >
            <UIcon :name="ICONS.players" class="size-3" />
            {{ aggregate.player_count }}
          </UBadge>
          <UBadge
            v-if="aggregate.match_count > 0"
            size="xs"
            variant="soft"
            color="primary"
            class="flex items-center gap-1"
          >
            <UIcon :name="ICONS.battle" class="size-3" />
            {{ aggregate.match_count }}
          </UBadge>
        </template>

        <!-- Event count badge (player-specific mode) -->
        <UTooltip v-else :text="eventCountLabel">
          <UButton
            v-if="isUsedInEvents"
            size="xs"
            variant="soft"
            color="info"
            :icon="ICONS.standings"
            disabled
          >
            {{ eventCount }}
          </UButton>
        </UTooltip>

        <!-- Edit / Delete actions (only when showActions is true) -->
        <DeckCardActions
          v-if="showActions"
          :deck="deck"
          :is-used-in-events="isUsedInEvents"
          @edit="emit('edit', $event)"
          @delete="emit('delete', $event)"
        />
      </div>
    </template>

    <!-- Image area: always aspect-[4/3], partners split it vertically -->
    <div class="aspect-4/3" :class="deck.commander_2_name ? 'flex flex-col' : ''">
      <CommanderArt
        :card-name="deck.commander_1_name"
        :art-url="art1"
        :mana-cost="commander1Data?.manaCost ?? undefined"
        :loading="loading"
      />
      <CommanderArt
        v-if="deck.commander_2_name"
        :card-name="deck.commander_2_name"
        :art-url="art2"
        :mana-cost="commander2Data?.manaCost ?? undefined"
        :loading="loading"
      />
    </div>

    <template #footer>
      <div class="flex items-center justify-between p-4">
        <div class="flex flex-col gap-1">
          <div v-if="hasCompanion && !isAggregate" class="text-sm text-muted flex items-center gap-1.5">
            <UIcon :name="ICONS.favorite" class="size-3.5 text-error" />
            <span>{{ deck.companion_name }}</span>
          </div>
          <div v-if="lenderName && !isAggregate" class="text-sm text-warning flex items-center gap-1.5">
            <UIcon :name="ICONS.assist" class="size-3.5" />
            <span>{{ lenderName }}</span>
          </div>
          <UBadge
            v-if="!isAggregate"
            :color="bracketDefinition ? BRACKET_COLORS[bracketDefinition.level] : 'neutral'"
            :variant="bracketDefinition ? 'soft' : 'outline'"
            size="sm"
            class="w-fit cursor-pointer"
            @click="openBracketPicker"
          >
            {{ bracketChipLabel }}
          </UBadge>
        </div>

        <div class="flex items-center gap-2">
          <UButton size="xs" variant="soft" color="primary" :icon="ICONS.statsLink" :to="statsPageUrl">
            {{ isAggregate ? t('deck.viewDetails') : t('deck.viewStats') }}
          </UButton>
          <UButton size="xs" variant="ghost" :icon="ICONS.externalLink" :to="scryfallSearchUrl" target="_blank">
            Scryfall
          </UButton>
        </div>
      </div>
    </template>
  </UCard>

  <BracketPickerModal
    v-if="!isAggregate"
    v-model:open="showBracketModal"
    :deck-name="deck.commander_1_name"
    :current-level="deck.bracket_level"
    @confirm="onBracketConfirm"
  />
</template>
