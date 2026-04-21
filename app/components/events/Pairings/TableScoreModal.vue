<script setup lang="ts">
import type { Pairing } from '#shared/utils/types'

interface Props {
  pairing: Pairing | null
  tableIndex: number | null
  getPlayerName: (playerId: number) => string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  submit: [scores: { team1: number; team2: number }]
}>()

const team1Score = ref(0)
const team2Score = ref(0)

function handleSubmit() {
  emit('submit', { team1: team1Score.value, team2: team2Score.value })
  open.value = false
}

function handleCancel() {
  open.value = false
}

function getPairingPlayers(pairing: Pairing | null): number[] {
  if (!pairing) return []
  return [pairing.pairing_player1_id, pairing.pairing_player2_id, pairing.pairing_player3_id, pairing.pairing_player4_id]
    .filter((id): id is number => !!id)
}

const team1Players = computed(() => {
  const players = getPairingPlayers(props.pairing)
  if (players.length >= 2) {
    return [players[0], players[1]]
  }
  return players
})

const team2Players = computed(() => {
  const players = getPairingPlayers(props.pairing)
  if (players.length >= 4) {
    return [players[2], players[3]]
  }
  return []
})
</script>

<template>
  <UModal v-model:open="open">
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-trophy" class="size-5 text-primary" />
          <h3 class="text-lg font-semibold">Inserisci Punteggi - Tavolo {{ tableIndex !== null ? tableIndex + 1 : '' }}</h3>
        </div>
      </template>

      <div class="space-y-6">
        <!-- Team 1 -->
        <div class="space-y-2">
          <h4 class="font-medium text-sm text-muted-foreground">Squadra 1</h4>
          <div class="flex items-center gap-2 p-3 bg-muted/30 rounded">
            <div class="flex-1 space-y-1">
              <div v-for="playerId in team1Players.filter((id): id is number => id !== undefined)" :key="playerId" class="text-sm">
                {{ getPlayerName(playerId) }}
              </div>
            </div>
            <UInput
              v-model="team1Score"
              type="number"
              min="0"
              class="w-20"
              placeholder="0"
            />
          </div>
        </div>

        <!-- Team 2 -->
        <div class="space-y-2">
          <h4 class="font-medium text-sm text-muted-foreground">Squadra 2</h4>
          <div class="flex items-center gap-2 p-3 bg-muted/30 rounded">
            <div class="flex-1 space-y-1">
              <div v-for="playerId in team2Players.filter((id): id is number => id !== undefined)" :key="playerId" class="text-sm">
                {{ getPlayerName(playerId) }}
              </div>
            </div>
            <UInput
              v-model="team2Score"
              type="number"
              min="0"
              class="w-20"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex gap-2 justify-end">
          <UButton
            color="neutral"
            variant="outline"
            @click="handleCancel"
          >
            Annulla
          </UButton>
          <UButton
            color="primary"
            @click="handleSubmit"
          >
            Conferma
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
