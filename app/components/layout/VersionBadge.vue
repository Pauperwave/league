<!-- app\components\layout\VersionBadge.vue -->
<script setup lang="ts">
import { computed } from 'vue'

const { public: { appVersion, appEnv } } = useRuntimeConfig()

const envColor = computed(() => {
  switch (appEnv) {
    case 'production': return 'success'
    case 'staging': return 'warning'
    default: return 'neutral'
  }
})
</script>

<template>
  <div class="fixed bottom-4 left-4 z-50 flex items-center gap-2">
    <UBadge :color="envColor" variant="subtle" size="sm">
      {{ appEnv }}
    </UBadge>
    <span v-if="appVersion" class="text-xs text-muted">v{{ appVersion }}</span>
  </div>
</template>
