<!-- app\components\event\round-status\RoundStatusSection.vue -->
<script setup lang="ts">
/**
 * Generic collapsible sub-card used by RoundStatusCard for each of the 4
 * categories (rankings/kills/commanders/votes) — no domain logic here, just
 * the chrome (chevron collapse, progress bar, done/total counter), same
 * collapsible pattern as WinnerChecklist.vue/StandingsCard.vue.
 */
interface Props {
  title: string
  icon: string
  doneCount: number
  totalCount: number
}

const { title, icon, doneCount, totalCount } = defineProps<Props>()

const isOpen = ref(false)

const percent = computed(() => totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100))
</script>

<template>
  <div class="bg-default rounded-xl p-2.5">
    <UCollapsible v-model:open="isOpen">
      <button type="button" class="flex items-center gap-1.5 mb-1.5 w-full cursor-pointer">
        <UIcon :name="icon" class="size-4 text-primary" />
        <h4 class="text-sm font-bold flex-1 text-left">{{ title }}</h4>
        <span class="text-xs text-muted">{{ doneCount }}/{{ totalCount }}</span>
        <UIcon :name="ICONS.chevronDown" class="size-3.5 text-muted transition-transform" :class="isOpen ? '' : '-rotate-90'" />
      </button>

      <UProgress :model-value="percent" size="sm" class="mb-1.5" />

      <template #content>
        <div class="space-y-1">
          <slot />
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
