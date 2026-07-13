<!-- app\components\deck\CommanderArtGallery.vue -->
<script setup lang="ts">
interface Props {
  image1: string | null
  image1Alt: string
  hasPartner?: boolean
  image2?: string | null
  image2Alt?: string
  loading?: boolean
}

const { image1, image1Alt, hasPartner = false, image2 = null, image2Alt = '', loading = false } = defineProps<Props>()

const panes = computed(() => {
  const result = [{ image: image1, alt: image1Alt }]
  if (hasPartner) result.push({ image: image2, alt: image2Alt })
  return result
})
</script>

<template>
  <div
    class="overflow-hidden rounded-lg bg-muted"
    :class="hasPartner ? 'aspect-2/3 flex flex-col gap-1' : 'aspect-2/3'"
  >
    <div
      v-for="(pane, index) in panes"
      :key="index"
      class="relative h-full w-full"
    >
      <ImageWithFallback
        :src="pane.image"
        :alt="pane.alt"
        :loading="loading"
      />
    </div>
  </div>
</template>
