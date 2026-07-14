<!-- app\components\layout\VersionBadge.vue -->
<script setup lang="ts">

const {
  public: { appVersion, appEnv }
} = useRuntimeConfig()

const envColor = computed(() => appEnv === 'production' ? 'success' : 'neutral')
</script>

<template>
  <div class="fixed bottom-4 left-4 z-50 flex items-center gap-2">
    <UBadge :color="envColor" variant="subtle" size="sm">
      {{ appEnv }}
    </UBadge>
    <span v-if="appVersion" class="text-md font-mono text-muted">
      v{{ appVersion }}
    </span>
  </div>
</template>
