<!-- app\components\PlayerNameTag.vue -->
<script setup lang="ts">
import { slugify } from '~/utils/slug'

interface Props {
  name: string
  surname: string
  avatarUrl?: string
  showAvatar?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  avatarUrl: undefined,
  showAvatar: true,
})

const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || '?')

const playerLink = computed(() => `/player/${slugify(`${props.name} ${props.surname}`.trim())}`)
</script>

<template>
  <div class="flex items-center gap-2">
    <UAvatar
      v-if="showAvatar"
      size="xs"
      :src="avatarUrl"
      :alt="name"
      icon="i-lucide-user"
    >
      {{ initial }}
    </UAvatar>
    <NuxtLink
      :to="playerLink"
      class="whitespace-nowrap leading-tight hover:underline hover:text-primary transition-colors"
    >
      {{ name }}
      <span class="font-bold">{{ surname }}</span>
    </NuxtLink>
  </div>
</template>
