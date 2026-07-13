<!-- app\components\event\pairing\table\score\TableScoreTeamRow.vue -->
<script setup lang="ts">
interface Props {
  label: string
  players: number[]
  getPlayerName: (playerId: number) => string
}

defineProps<Props>()

const score = defineModel<number>({ required: true })
</script>

<template>
  <div class="space-y-2">
    <h4 class="font-medium text-sm text-muted-foreground">{{ label }}</h4>
    <div class="flex items-center gap-2 p-3 bg-muted/30 rounded">
      <div class="flex-1 space-y-1">
        <div v-for="playerId in players" :key="playerId" class="text-sm">
          {{ getPlayerName(playerId) }}
        </div>
      </div>
      <UInput
        v-model="score"
        type="number"
        min="0"
        class="w-20"
        placeholder="0"
      />
    </div>
  </div>
</template>
