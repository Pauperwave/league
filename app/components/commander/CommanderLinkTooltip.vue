<!-- app\components\commander\CommanderLinkTooltip.vue -->
<script setup lang="ts">
/**
 * A `/commander/:slug` link that shows the card art on hover — same visual
 * treatment as CommanderSuggestionRow.vue's search-dropdown preview
 * (transparent/borderless UTooltip content, no arrow). Unlike that
 * component, this trigger isn't nested inside a Reka listbox, so UTooltip's
 * own hover trigger works directly — no need for its manual pointer-tracking
 * workaround.
 *
 * One real difference from that precedent: there, `imageUrl` is already
 * synchronously available (pre-loaded catalog) by the time a row is
 * hovered — here the card is fetched on-demand on open, so there's a gap
 * before it's ready. The `#content` slot's wrapper div is therefore always
 * rendered at a fixed size (not gated by `v-if`, which would leave Floating
 * UI positioning against an empty/zero-size target and never recheck once
 * the image arrives) — the image just fades into that already-positioned box.
 *
 * The card fetch is gated on `isOpen` (Colada `enabled`) so hovering 200
 * commander rows on page load never fires 200 requests — only the ones
 * actually hovered, and each is cached by name afterward.
 */
const { name, to } = defineProps<{
  name: string
  /** Override the default `/commander/:slug` target (e.g. an already-known slug). */
  to?: string
}>()

const isOpen = ref(false)
const { commander1Data: card } = useCommanderCards(
  computed(() => isOpen.value ? name : null),
  undefined
)

const linkTo = computed(() => to ?? `/commander/${slugify(name)}`)
</script>

<template>
  <UTooltip
    v-model:open="isOpen"
    :arrow="false"
    :content="{ align: 'start', side: 'right', sideOffset: 10, updatePositionStrategy: 'always' }"
    :ui="{ content: 'bg-transparent border-0 shadow-none p-0' }"
  >
    <NuxtLink :to="linkTo" class="text-primary hover:underline font-medium">
      <slot>{{ name }}</slot>
    </NuxtLink>

    <template #content>
      <div class="w-70 h-auto rounded-xl shadow-2xl">
        <img
          v-if="card?.largeImageUrl"
          :src="card.largeImageUrl"
          :alt="name"
          class="size-full rounded-xl shadow-2xl object-cover"
        >
      </div>
    </template>
  </UTooltip>
</template>
