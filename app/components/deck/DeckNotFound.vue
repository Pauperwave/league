<!-- app\components\deck\DeckNotFound.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'

const { t } = useI18n()
</script>

<template>
  <div class="text-center py-12 text-muted">
    <UIcon :name="ICONS.noCommander" class="text-4xl mb-2 opacity-30" />
    <p>{{ t('deck.notFound') }}</p>
  </div>
</template>
