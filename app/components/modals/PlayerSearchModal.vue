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

const items = computed(() =>
  props.players
    .filter(p => !props.waitingPlayers.includes(p.player_id))
    .map(p => ({
      label: `${p.player_name} ${p.player_surname}`,
      value: String(p.player_id)
    }))
)

function handleConfirm() {
  if (selectedPlayerIds.value.length > 0) {
    emit('select', selectedPlayerIds.value.map(id => parseInt(id)))
    selectedPlayerIds.value = []
    open.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    selectedPlayerIds.value = []
  }
})
</script>

<template>
  <UModal v-model:open="open" title="Aggiungi Giocatori">
    <template #body>
      <div class="space-y-4">
        <USelectMenu
          v-model="selectedPlayerIds"
          :items="items"
          value-key="value"
          multiple
          placeholder="Cerca giocatori..."
          search
          searchable-placeholder="Cerca per nome..."
          class="w-full"
        />

        <p v-if="props.players.length === 0" class="text-muted text-center py-4">
          Nessun giocatore registrato
        </p>
        <p v-else-if="items.length === 0" class="text-muted text-center py-4">
          Tutti i giocatori sono già nella lista d'attesa
        </p>
        <p v-else-if="selectedPlayerIds.length > 0" class="text-sm text-muted">
          {{ selectedPlayerIds.length }} giocatore/i selezionato/i
        </p>
      </div>
    </template>
    <template #footer>
      <UButton color="neutral" variant="ghost" @click="open = false">
        Chiudi
      </UButton>
      <UButton
        color="primary"
        :disabled="selectedPlayerIds.length === 0"
        @click="handleConfirm"
      >
        Aggiungi ({{ selectedPlayerIds.length }})
      </UButton>
    </template>
  </UModal>
</template>
