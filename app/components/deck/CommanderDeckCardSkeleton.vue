<!-- app\components\deck\CommanderDeckCardSkeleton.vue -->
<script setup lang="ts">
// Mirrors CommanderDeckCard.vue's layout (header badges, aspect-4/3 image,
// footer buttons) so grids don't reflow when real cards replace it.
</script>

<template>
  <UCard
    class="overflow-hidden"
    :ui="{
      body: 'p-0 sm:p-0',
      footer: 'px-3 py-2'
    }">
    <template #header>
      <div class="flex items-center gap-2">
        <USkeleton class="h-5 w-24 rounded-full" />
        <div class="flex items-center gap-2 shrink-0 ms-auto">
          <USkeleton class="h-5 w-10 rounded-full" />
        </div>
      </div>
    </template>

    <USkeleton class="aspect-4/3 w-full rounded-none" />

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <USkeleton class="h-6 w-24" />
        <USkeleton class="h-6 w-20" />
      </div>
    </template>
  </UCard>
</template>
