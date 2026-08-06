<!-- app\components\player\PlayerDecksSection.vue -->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- accepted clone: empty-state icon+text block shared with
// commander/[commanderSlug].vue (same generic pattern repeats untracked in other pages, e.g. /commanders, /players)
import type { CommanderDeck } from '#shared/utils/types'

interface Props {
  loading: boolean
  decks: CommanderDeck[]
  slug: string
  getTournamentCount: (deck: CommanderDeck) => number
}

const {
  loading,
  decks,
  slug,
  getTournamentCount
} = defineProps<Props>()

const emit = defineEmits<{
  addDeck: []
  edit: [deck: CommanderDeck]
  delete: [deck: CommanderDeck]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="bg-elevated rounded-xl p-6 border border-default shadow-lg">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <UIcon :name="ICONS.commander" class="size-5 text-primary" />
        <h2 class="text-lg font-bold">{{ t('player.decksSection.heading') }}</h2>
      </div>
      <UButton
        size="sm"
        color="primary"
        variant="soft"
        :icon="ICONS.add"
        @click="emit('addDeck')"
      >
        {{ t('player.decksSection.addDeck') }}
      </UButton>
    </div>

    <!-- Only the initial fetch (no data yet) shows skeleton cards — background
    refetches (e.g. after a bracket save invalidates the decks query) keep the
    real grid mounted instead of flashing it away, which otherwise reads as a
    full-page reload. -->
    <div v-if="loading && decks.length === 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <CommanderDeckCardSkeleton v-for="n in 3" :key="n" />
    </div>

    <div v-else-if="decks.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <CommanderDeckCard
        v-for="deck in decks"
        :key="deck.id"
        :deck="deck"
        :player-slug="slug"
        :tournament-count="getTournamentCount(deck)"
        show-actions
        @edit="emit('edit', deck)"
        @delete="emit('delete', deck)"
      />
    </div>

    <div v-else class="text-center py-8 text-muted">
      <UIcon :name="ICONS.noCommander" class="text-4xl mb-2 opacity-30" />
      <p>{{ t('player.decksSection.empty') }}</p>
    </div>
  </div>
</template>
