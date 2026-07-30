<!-- app\components\ui\layout\PageHeaderRow.vue -->
<script setup lang="ts">

interface Props {
  title: string
}

defineProps<Props>()

const { t } = useI18n()

const homeLogging = useButtonLogging(t('logging.navigation.home'))
</script>

<template>
  <div class="flex items-center justify-between">
    <UButton color="neutral" :icon="ICONS.back" to="/" @click="homeLogging.logClick()">
      {{ t('common.home') }}
    </UButton>
    <h1 class="text-2xl font-bold">
      {{ title }}
    </h1>
    <slot />
  </div>
</template>
