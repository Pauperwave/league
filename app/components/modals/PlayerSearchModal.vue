<!-- app\components\Modals\PlayerSearchModal.vue -->
<script setup lang="ts">
import type { Player } from '#shared/utils/types'

interface Props {
  players: Player[]
  waitingPlayers: number[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [playerIds: number[]]
}>()

const open = defineModel<boolean>('open', { default: false })

const selectedPlayerIds = ref<string[]>([])

const hasSelection = computed(() => selectedPlayerIds.value.length > 0)

const allPlayersInQueue = computed(() =>
  props.players.every(p => props.waitingPlayers.includes(p.player_id))
)

const items = computed(() =>
  props.players
    .filter(p => !props.waitingPlayers.includes(p.player_id))
    .map(p => ({
      label: `${p.player_name} ${p.player_surname}`,
      value: String(p.player_id),
    }))
)

// Reset selection whenever the modal opens
watch(open, (isOpen) => {
  if (isOpen) selectedPlayerIds.value = []
})

function handleConfirm() {
  emit('select', selectedPlayerIds.value.map(Number))
  selectedPlayerIds.value = []
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open">
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-user-plus" class="text-primary" />
        <span>Aggiungi giocatori alla lista d'attesa</span>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <USelectMenu
          v-model="selectedPlayerIds"
          :items="items"
          value-key="value"
          multiple
          placeholder="Cerca giocatori..."
          :search-input="{ placeholder: 'Cerca per nome...' }"
          class="w-full"
        />

        <p v-if="players.length === 0" class="text-muted text-center py-4">
          Nessun giocatore registrato
        </p>
        <p v-else-if="allPlayersInQueue" class="text-muted text-center py-4">
          Tutti i giocatori sono già nella lista d'attesa
        </p>
        <p v-else-if="hasSelection" class="text-sm text-muted">
          {{ selectedPlayerIds.length }} giocatore/i selezionato/i
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-between w-full">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-x"
          @click="open = false"
        >
          Chiudi
        </UButton>
        <UButton
          color="primary"
          icon="i-lucide-user-plus"
          :disabled="!hasSelection"
          @click="handleConfirm"
        >
          Aggiungi ({{ selectedPlayerIds.length }})
        </UButton>
      </div>
    </template>
  </UModal>
</template>
