<!-- app\components\charts\BaseChart.vue -->
<script setup lang="ts">
const {
  option,
  height = '18rem',
  loading = false
} = defineProps<{
  option: ECOption
  height?: string
  loading?: boolean
}>()
</script>

<template>
  <VChart
    :option="option"
    :loading="loading"
    autoresize
    :style="{ height }"
  />
</template>
