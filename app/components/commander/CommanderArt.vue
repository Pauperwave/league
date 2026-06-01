<!-- app\components\CommanderArt.vue -->
<script setup lang="ts">
defineProps<{
  cardName: string
  artUrl: string | null
  manaCost?: string
  loading?: boolean
  size?: 'sm' | 'base'
}>()
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-muted">
    <img
      v-if="artUrl"
      :src="artUrl"
      :alt="`Art for ${cardName}`"
      class="w-full h-full object-cover object-top"
      loading="lazy"
    >
    <div v-else-if="loading" class="flex items-center justify-center h-full">
      <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-muted" />
    </div>
    <div v-else class="flex items-center justify-center h-full text-muted">
      <UIcon name="i-lucide-image-off" class="text-4xl opacity-30" />
    </div>

    <div v-if="artUrl" class="absolute inset-0 bg-linear-to-b from-transparent to-[#171717]">
      <div
        class="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-1"
        :class="size === 'sm' ? 'p-2' : 'p-3'"
      >
        <h4
          class="font-bold text-white truncate"
          :class="size === 'sm' ? 'text-sm' : 'text-base'"
          :title="cardName"
        >
          {{ cardName }}
        </h4>
        <ManaCost v-if="manaCost" :mana-cost="manaCost" size="sm" />
      </div>
    </div>
  </div>
</template>
