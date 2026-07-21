<!-- app\components\player\PlayerNameTag.vue -->
<script setup lang="ts">

const {
  name,
  surname,
  avatarUrl,
  playerId,
  showAvatar = true,
  linkable = true,
  wrap = false,
  avatarSize = 'xs'
} = defineProps<{
  name: string
  surname: string
  avatarUrl?: string
  playerId?: number
  showAvatar?: boolean
  /** Set to false in contexts where navigating away isn't wanted (e.g. mid-drag in the table pairing preview). */
  linkable?: boolean
  /** Set to true to let long names wrap instead of the default single-line ellipsis-free nowrap. */
  wrap?: boolean
  avatarSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}>()

const playerLink = computed(() => `/player/${slugify(`${name} ${surname}`.trim())}`)

// Deterministic placeholder avatar when there's no real avatarUrl — seeded by
// playerId when available, falling back to the full name for callers that
// don't have it (still deterministic, just less guaranteed-unique).
const displayAvatar = computed(() => avatarUrl || generatePlayerAvatar(playerId ?? `${name} ${surname}`))
</script>

<template>
  <div class="flex items-center gap-2">
    <UAvatar
      v-if="showAvatar"
      :size="avatarSize"
      :src="displayAvatar"
      :alt="name"
    />
    <component
      :is="linkable ? 'NuxtLink' : 'span'"
      :to="linkable ? playerLink : undefined"
      class="inline-flex items-baseline gap-1 leading-tight"
      :class="[
        wrap ? 'flex-wrap' : 'flex-nowrap',
        linkable ? 'hover:underline hover:text-primary transition-colors' : ''
      ]"
    >
      <span class="whitespace-nowrap">{{ name }}</span>
      <span class="font-bold text-primary whitespace-nowrap">{{ surname }}</span>
    </component>
  </div>
</template>
