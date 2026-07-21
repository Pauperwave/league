<!-- app\components\player\PlayerDecksSection.vue -->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- accepted clone: empty-state icon+text block shared with
// commander/[commanderSlug].vue (same generic pattern repeats untracked in other pages, e.g. /commanders, /players)
import type { CommanderDeck } from '#shared/utils/types'

interface Props {
  loading: boolean
  decks: CommanderDeck[]
  slug: string
  getEventCount: (deck: CommanderDeck) => number
}

const { loading, decks, slug, getEventCount } = defineProps<Props>()

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

    <div v-if="loading" class="flex items-center justify-center py-8">
      <UIcon :name="ICONS.loading" class="animate-spin text-2xl text-primary" />
    </div>

    <div v-else-if="decks.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <CommanderDeckCard
        v-for="deck in decks"
        :key="deck.id"
        :deck="deck"
        :player-slug="slug"
        :event-count="getEventCount(deck)"
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
