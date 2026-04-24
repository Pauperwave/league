<!-- app\components\Modals\PlayerSearchModal.vue -->
<script setup lang="ts">
import type { Player } from '#shared/utils/types'
import { usePlayerOptions } from '~/composables/supabase/usePlayers'
import { useButtonLogging } from '~/composables/useButtonLogging'

interface Props {
  players: Player[]
  waitingPlayers: number[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [playerIds: number[]]
  createNew: []
}>()

const open = defineModel<boolean>('open', { default: false })

const selectedPlayerIds = ref<string[]>([])

const confirmLogging = useButtonLogging('Confirm Player Selection', { selectedCount: () => selectedPlayerIds.value.length })
const createNewLogging = useButtonLogging('Create New Player')
const closeLogging = useButtonLogging('Close Player Search Modal')

const hasSelection = computed(() => selectedPlayerIds.value.length > 0)

const allPlayersInQueue = computed(() =>
  props.players.every(p => props.waitingPlayers.includes(p.player_id))
)

const availablePlayers = computed(() =>
  props.players.filter(p => !props.waitingPlayers.includes(p.player_id))
)

const items = usePlayerOptions(availablePlayers)

// Reset selection whenever the modal opens
watch(open, (isOpen) => {
  if (isOpen) selectedPlayerIds.value = []
})

function handleConfirm() {
  confirmLogging.logClick()
  emit('select', selectedPlayerIds.value.map(Number))
  selectedPlayerIds.value = []
  open.value = false
}

function handleCreateNew() {
  createNewLogging.logClick()
  emit('createNew')
  open.value = false
}

function handleClose() {
  closeLogging.logClick()
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
          icon="i-lucide-x"
          @click="handleClose"
        >
          Chiudi
        </UButton>
        <div class="flex items-center gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-user-plus"
            @click="handleCreateNew"
          >
            Crea nuovo
          </UButton>
          <UButton
            color="primary"
            icon="i-lucide-user-check"
            :disabled="!hasSelection"
            @click="handleConfirm"
          >
            Aggiungi ({{ selectedPlayerIds.length }})
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
