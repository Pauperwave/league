<!-- app\components\deck\ScryfallLinkButton.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'

interface Props {
  url: string
}

const { url } = defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <div class="flex items-center gap-2">
    <UButton
      :icon="ICONS.externalLink"
      :to="url"
      target="_blank"
      color="neutral"
      variant="outline"
    >
      {{ t('deck.viewOnScryfall') }}
    </UButton>
  </div>
</template>
