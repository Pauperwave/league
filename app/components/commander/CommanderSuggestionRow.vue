<!-- app\components\commander\CommanderSuggestionRow.vue -->
<script setup lang="ts">
interface Props {
  label: string
  tokens?: string[]
  matchIndices?: number[]
  imageUrl?: string | null
}

const {
  label,
  tokens = [],
  matchIndices = [],
  imageUrl
} = defineProps<Props>()

const tooltipOpen = ref(false)
const anchor = ref({ x: 0, y: 0 })

// USelectMenu's item list is a Reka listbox with its own pointer/focus
// handling for row highlighting — nesting UTooltip's built-in hover-trigger
// (TooltipTrigger, which listens for pointerenter/focus on the slotted
// element) inside it never fires, the listbox swallows the events first.
// Bypassing hover-trigger entirely — manual pointer tracking + a virtual
// :reference anchored to the cursor + controlled v-model:open — is the same
// workaround already proven in blog/app/components/magic/card/Tooltip.vue.
const reference = computed(() => ({
  getBoundingClientRect: () => ({
    width: 0,
    height: 0,
    left: anchor.value.x,
    right: anchor.value.x,
    top: anchor.value.y,
    bottom: anchor.value.y,
    ...anchor.value,
  } as DOMRect),
}))

function handlePointerEnter(ev: PointerEvent) {
  if (!imageUrl) return
  anchor.value = { x: ev.clientX, y: ev.clientY }
  tooltipOpen.value = true
}

function handlePointerLeave() {
  tooltipOpen.value = false
}

function handlePointerMove(ev: PointerEvent) {
  if (tooltipOpen.value) anchor.value = { x: ev.clientX, y: ev.clientY }
}
</script>

<template>
  <UTooltip
    v-model:open="tooltipOpen"
    :arrow="false"
    :reference="reference"
    :content="{ align: 'start', side: 'right', sideOffset: 10, updatePositionStrategy: 'always' }"
    :ui="{ content: 'bg-transparent border-0 shadow-none p-0' }"
  >
    <span
      class="flex items-center gap-2 min-w-0"
      @pointerenter="handlePointerEnter"
      @pointerleave="handlePointerLeave"
      @pointermove="handlePointerMove"
    >
      <span
        v-if="tokens.length"
        class="shrink-0 bg-gray-950 p-1 rounded"
      >
        <ManaCost :mana-cost="tokens.join('')" size="sm" />
      </span>
      <span class="truncate">
        <component :is="() => highlightFuzzyChars(label, matchIndices)" />
      </span>
    </span>

    <template
      v-if="imageUrl"
      #content
    >
      <img
        :src="imageUrl"
        :alt="label"
        class="w-70 h-auto rounded-xl shadow-2xl"
      >
    </template>
  </UTooltip>
</template>
