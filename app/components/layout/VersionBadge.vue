<!-- app\components\layout\VersionBadge.vue -->
<script setup lang="ts">

const {
  public: { appVersion, appEnv }
} = useRuntimeConfig()

const envColor = computed(() => appEnv === 'production' ? 'success' : 'neutral')
</script>

<template>
  <div class="fixed bottom-4 left-4 z-50">
    <UBadge
      :color="envColor"
      variant="subtle"
      size="lg"
      class="gap-2 text-sm"
    >
      <span>{{ appEnv }}</span>
      <span v-if="appVersion" class="font-mono opacity-75">v{{ appVersion }}</span>
    </UBadge>
  </div>
</template>
