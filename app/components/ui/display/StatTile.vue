<!-- app\components\ui\display\StatTile.vue -->
<script setup lang="ts">
interface Props {
  icon: string
  value: number | string
  label: string
  color?: string
  background?: string
}

const { icon, value, label, color = 'text-primary', background = 'bg-default' } = defineProps<Props>()
</script>

<template>
  <div class="flex items-center gap-3 p-3 rounded-lg" :class="background">
    <UIcon :name="icon" class="size-5 shrink-0" :class="color" />
    <div>
      <p class="text-xl font-bold leading-none">{{ value }}</p>
      <p class="text-xs text-muted">{{ label }}</p>
    </div>
  </div>
</template>
