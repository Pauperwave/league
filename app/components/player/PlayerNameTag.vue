<!-- app\components\PlayerNameTag.vue -->
<script setup lang="ts">
import { slugify } from '~/utils/slug'

const {
  name,
  surname,
  avatarUrl,
  showAvatar = true
} = defineProps<{
  name: string
  surname: string
  avatarUrl?: string
  showAvatar?: boolean
}>()

const initial = computed(() => name.trim().charAt(0).toUpperCase() || '?')

const playerLink = computed(() => `/player/${slugify(`${name} ${surname}`.trim())}`)
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
