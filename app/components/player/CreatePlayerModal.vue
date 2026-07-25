<!-- app\components\player\CreatePlayerModal.vue -->
<script setup lang="ts">
import type { Player, NewPlayer } from '#shared/utils/types'
import type { PlayerUpdatePayload } from '~/composables/players/usePlayerMutations'

const props = defineProps<{
  player: Player | null
  existingPlayers: Player[]
  /** Changes what "similar player found" resolves to: adding to the current
   * event's waiting list ('event') vs. just locating them in the /players
   * table via search ('players') — the two contexts this modal is used in. */
  context: 'event' | 'players'
}>()

const emit = defineEmits<{
  create: [player: NewPlayer]
  update: [PlayerUpdatePayload]
  select: [playerId: number]
  search: [query: string]
}>()

const open = defineModel<boolean>('open', { default: false })

// — Derived modal state —
const isEditing = computed(() => !!props.player)
const { title: modalTitle, description: modalDescription, icon: modalIcon, submitLabel, handleCancel } = useFormModalMeta({
  isEditing,
  namespace: 'player',
  createIcon: ICONS.addPlayer,
  cancelLoggingLabel: 'Cancel Player Form',
  open
})

const isFormValid = ref(false)

function handleCreate(player: NewPlayer) {
  emit('create', player)
  open.value = false
}

function handleUpdate(payload: PlayerUpdatePayload) {
  emit('update', payload)
  open.value = false
}

function handleSelect(playerId: number) {
  emit('select', playerId)
  open.value = false
}

function handleSearch(query: string) {
  emit('search', query)
  open.value = false
}
</script>

<template>
  <FormModal
    v-model:open="open"
    :title="modalTitle"
    :description="modalDescription"
    :icon="modalIcon"
    :submit-label="submitLabel"
    :submit-icon="ICONS.addPlayer"
    form-id="player-form"
    :disabled="!isFormValid"
    @cancel="handleCancel"
  >
    <PlayerCreateForm
      v-model:valid="isFormValid"
      form-id="player-form"
      :player="player"
      :existing-players="existingPlayers"
      :context="context"
      @create="handleCreate"
      @update="handleUpdate"
      @select="handleSelect"
      @search="handleSearch"
    />
  </FormModal>
</template>
