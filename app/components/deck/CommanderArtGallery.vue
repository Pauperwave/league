<!-- app\components\deck\CommanderArtGallery.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'

interface Props {
  image1: string | null
  image1Alt: string
  hasPartner?: boolean
  image2?: string | null
  image2Alt?: string
  loading?: boolean
}

const { image1, image1Alt, hasPartner = false, image2 = null, image2Alt = '', loading = false } = defineProps<Props>()
</script>

<template>
  <div
    class="overflow-hidden rounded-lg bg-muted"
    :class="hasPartner ? 'aspect-2/3 flex flex-col gap-1' : 'aspect-2/3'"
  >
    <div class="relative h-full w-full">
      <img
        v-if="image1"
        :src="image1"
        :alt="image1Alt"
        class="w-full h-full object-cover object-top"
      >
      <div v-else-if="loading" class="flex items-center justify-center h-full">
        <UIcon :name="ICONS.loading" class="animate-spin text-2xl text-muted" />
      </div>
      <div v-else class="flex items-center justify-center h-full text-muted">
        <UIcon :name="ICONS.imageMissing" class="text-4xl opacity-30" />
      </div>
    </div>
    <div v-if="hasPartner" class="relative h-full w-full">
      <img
        v-if="image2"
        :src="image2"
        :alt="image2Alt"
        class="w-full h-full object-cover object-top"
      >
      <div v-else-if="loading" class="flex items-center justify-center h-full">
        <UIcon :name="ICONS.loading" class="animate-spin text-2xl text-muted" />
      </div>
      <div v-else class="flex items-center justify-center h-full text-muted">
        <UIcon :name="ICONS.imageMissing" class="text-4xl opacity-30" />
      </div>
    </div>
  </div>
</template>
