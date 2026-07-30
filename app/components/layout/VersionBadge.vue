<!-- app\components\layout\VersionBadge.vue -->
<script setup lang="ts">

const {
  public: { appVersion, appEnv }
} = useRuntimeConfig()

const envColor = computed(() => appEnv === 'production' ? 'success' : 'neutral')
</script>

<template>
  <div class="fixed bottom-4 left-4 z-50">
    <UBadge :color="envColor" variant="subtle" size="sm" class="gap-1.5">
      <span>{{ appEnv }}</span>
      <span v-if="appVersion" class="font-mono opacity-75">v{{ appVersion }}</span>
    </UBadge>
  </div>
</template>
