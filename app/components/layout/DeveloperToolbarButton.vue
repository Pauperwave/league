<!-- app\components\layout\DeveloperToolbarButton.vue -->
<!--
  DeveloperToolbarButton.vue

  Shared shell for a header icon button that only shows while developer view
  is on (useDeveloperView.ts) — ClientOnly + tooltip + size-8 SSR fallback,
  used by ActionLogTrigger.vue and DeveloperOverlayToggle.vue. Not for
  DeveloperViewToggle.vue itself, which also needs a v-else UPopover branch
  this shell doesn't have.
-->
<script setup lang="ts">
import type { IconName } from '~/utils/icons'
import type { SemanticColor } from '~/utils/semanticColor'

const {
  icon,
  color = 'neutral',
  variant = 'ghost',
  buttonAriaLabel
} = defineProps<{
  icon: IconName
  color?: SemanticColor | 'neutral'
  variant?: 'ghost' | 'soft'
  buttonAriaLabel: string
}>()

const emit = defineEmits<{
  click: []
}>()

const { isDeveloperView } = useDeveloperView()
</script>

<template>
  <ClientOnly>
    <UTooltip
      v-if="isDeveloperView"
      :content="{ side: 'bottom' }"
      :text="buttonAriaLabel"
    >
      <UButton
        :icon="icon"
        :color="color"
        :variant="variant"
        :aria-label="buttonAriaLabel"
        @click="emit('click')"
      />
    </UTooltip>

    <template #fallback>
      <div class="size-8" />
    </template>
  </ClientOnly>
</template>
