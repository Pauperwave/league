<!-- app\components\deck\DeckHeader.vue -->
<script setup lang="ts">

interface Props {
  displayName: string
  manaCost?: string | null
  loading?: boolean
  companionName?: string | null
}

const { displayName, manaCost, loading = false, companionName } = defineProps<Props>()
</script>

<template>
  <div class="flex items-center gap-4">
    <UIcon :name="ICONS.battle" class="size-8 text-primary" />
    <div class="min-w-0">
      <h1 class="text-2xl font-bold truncate">
        {{ displayName }}
      </h1>
      <div class="flex items-center gap-2 mt-1">
        <ManaCost
          v-if="manaCost"
          :mana-cost="manaCost"
          size="md"
        />
        <UIcon
          v-else-if="loading"
          :name="ICONS.loading"
          class="animate-spin size-4 text-muted"
        />
        <UBadge v-if="companionName" variant="soft" color="error" class="text-xs">
          <UIcon :name="ICONS.favorite" class="size-3 mr-1" />
          {{ companionName }}
        </UBadge>
      </div>
    </div>
  </div>
</template>
