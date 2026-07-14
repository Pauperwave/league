<!-- app\components\event\CurrentTime.vue -->
<script setup lang="ts">
const now = ref(new Date())

useIntervalFn(() => {
  now.value = new Date()
}, 1000, { immediate: true })

const display = computed(() =>
  now.value.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
)
</script>

<template>
  <div class="flex items-center gap-[1.5cqmin]">
    <UIcon
      :name="ICONS.clock"
      class="size-[10cqmin]"
    />
    <span class="font-mono font-semibold tabular-nums text-[10cqmin]">
      {{ display }}
    </span>
  </div>
</template>
