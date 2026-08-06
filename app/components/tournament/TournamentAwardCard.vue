<!-- app\components\tournament\TournamentAwardCard.vue -->
<script setup lang="ts">
import type { TournamentAwardKind } from '~/composables/tournament/useTournamentAwards'

const {
  kind, playerId, playerName, playerSurname, value 
} = defineProps<{
  kind: TournamentAwardKind
  playerId: number
  playerName: string
  playerSurname: string
  value: number
}>()

const { t } = useI18n()

// Fixed, hand-picked card art per award (not the winning player's own
// commander) — these are flavor illustrations for the award itself, e.g. a
// death/reaper scene for "La Vittima", so they don't change as standings do.
const ART_URLS: Record<TournamentAwardKind, string> = {
  victim: 'https://cards.scryfall.io/art/front/e/e/ee008d81-df28-49a8-917d-44f66527e469.webp?1783907079',
  killer: 'https://cards.scryfall.io/art/front/f/8/f8fc7a61-226c-426a-9b99-21d87aca2f6f.webp?1783931343',
  brewer: 'https://cards.scryfall.io/art/front/a/c/acf6399f-f389-4b13-8563-a078a5d198f4.webp?1783910728',
  player: 'https://cards.scryfall.io/art/front/a/c/acadf575-2076-4f0c-b66e-994898adf375.webp?1783933770',
}

const ICON_BY_KIND: Record<TournamentAwardKind, string> = {
  victim: ICONS.deaths,
  killer: ICONS.kills,
  brewer: ICONS.brewVotes,
  player: ICONS.playVotes,
}

const COLOR_BY_KIND: Record<TournamentAwardKind, string> = {
  victim: 'text-error',
  killer: 'text-warning',
  brewer: 'text-info',
  player: 'text-success',
}

const artUrl = computed(() => ART_URLS[kind])
const icon = computed(() => ICON_BY_KIND[kind])
const iconColorClass = computed(() => COLOR_BY_KIND[kind])
const title = computed(() => t(`tournament.awards.${kind}.title`))
const statLabel = computed(() => t(`tournament.awards.${kind}.stat`, { count: value }))
</script>

<template>
  <div class="relative rounded-xl overflow-hidden border border-default shadow-lg aspect-16/10 bg-muted">
    <ImageWithFallback :src="artUrl" :alt="title" />

    <div class="absolute inset-0 bg-linear-to-t from-black/90 via-black/10 to-transparent" />

    <div class="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
      <UIcon :name="icon" class="size-3.5" :class="iconColorClass" />
      <span class="text-xs font-bold text-white uppercase tracking-wide">{{ title }}</span>
    </div>

    <div class="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between gap-2">
      <PlayerNameTag
        :name="playerName"
        :surname="playerSurname"
        :player-id="playerId"
        avatar-size="md"
        class="text-white"
      />
      <span class="text-white font-bold text-sm shrink-0">{{ statLabel }}</span>
    </div>
  </div>
</template>
