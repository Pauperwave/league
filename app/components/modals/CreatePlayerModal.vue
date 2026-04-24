<!-- app\components\Modals\CreatePlayerModal.vue -->
<script setup lang="ts">
import type { Player, NewPlayer } from '#shared/utils/types'
import { findSimilarPlayers } from '#shared/utils/playerSimilarity'
import { useButtonLogging } from '~/composables/useButtonLogging'

interface Props {
  player: Player | null
  existingPlayers: Player[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  create: [player: NewPlayer]
  update: [{ id: number, data: NewPlayer }]
  select: [playerId: number]
}>()

const open = defineModel<boolean>('open', { default: false })

const submitLogging = useButtonLogging('Submit Player Form', { isEditing: () => isEditing.value, data: () => ({ firstName: form.firstName, lastName: form.lastName }) })
const selectExistingLogging = useButtonLogging('Select Existing Player')
const cancelLogging = useButtonLogging('Cancel Player Form')

// — Derived modal state —
const isEditing = computed(() => !!props.player)
const modalTitle = computed(() => isEditing.value ? 'Modifica Giocatore' : 'Crea Nuovo Giocatore')
const modalDescription = computed(() => isEditing.value ? 'Modifica i dati del giocatore' : 'Cerca giocatori esistenti prima di crearne uno nuovo')
const modalIcon = computed(() => isEditing.value ? 'i-lucide-pencil' : 'i-lucide-user-plus')
const submitLabel = computed(() => isEditing.value ? 'Salva' : 'Crea Giocatore')

// — Form —
const defaultForm = (): { firstName: string, lastName: string } => ({
  firstName: '',
  lastName: '',
})

const form = shallowReactive(defaultForm())

const isValid = computed(() => !!form.firstName.trim() && !!form.lastName.trim())

// — Similarity check (solo in modalità creazione) —
const similarPlayers = computed(() => {
  if (isEditing.value || !isValid.value) return []
  return findSimilarPlayers(props.existingPlayers, form.firstName, form.lastName)
})

const hasSimilarPlayers = computed(() => similarPlayers.value.length > 0)

const canCreate = computed(() => {
  if (!isValid.value) return false
  // In modifica: sempre valido
  if (isEditing.value) return true
  // In creazione: valido solo se non ci sono giocatori simili
  return !hasSimilarPlayers.value
})

watch(open, (isOpen) => {
  if (!isOpen) return

  const p = props.player
  Object.assign(form, p
    ? { firstName: p.player_name, lastName: p.player_surname }
    : defaultForm()
  )
})

function handleSubmit() {
  if (!isValid.value) return

  const data: NewPlayer = {
    player_name: form.firstName.trim(),
    player_surname: form.lastName.trim(),
  }

  submitLogging.logClick()

  if (isEditing.value && props.player) {
    emit('update', { id: props.player.player_id, data })
  }
  else {
    emit('create', data)
    Object.assign(form, defaultForm())
  }

  open.value = false
}

function handleSelectExisting(playerId: number) {
  selectExistingLogging.logClick()
  emit('select', playerId)
  Object.assign(form, defaultForm())
  open.value = false
}

function handleCancel() {
  cancelLogging.logClick()
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :description="modalDescription"
    :ui="{ footer: 'justify-between' }"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon :name="modalIcon" class="text-primary" />
        <span>{{ modalTitle }}</span>
      </div>
    </template>

    <template #body>
      <form id="player-form" class="space-y-4" @submit.prevent="handleSubmit">
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Nome" required>
            <UInput
              id="field-firstname"
              v-model="form.firstName"
              placeholder="Es. Mario"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Cognome" required>
            <UInput
              id="field-lastname"
              v-model="form.lastName"
              placeholder="Es. Rossi"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Warning: giocatori simili trovati (solo in creazione) -->
        <UCard
          v-if="!isEditing && hasSimilarPlayers"
          variant="outline"
          class="border-warning"
        >
          <div class="space-y-3">
            <div class="flex items-center gap-2 text-warning">
              <UIcon name="i-lucide-alert-triangle" class="size-5" />
              <span class="font-medium">Giocatori simili trovati</span>
            </div>

            <p class="text-sm text-muted">
              Verifica che il giocatore non sia già registrato:
            </p>

            <ul class="space-y-2">
              <li
                v-for="{ player: similarPlayer, combinedSimilarity } in similarPlayers"
                :key="similarPlayer.player_id"
                class="flex items-center justify-between p-2 bg-muted/50 rounded"
              >
                <span class="font-medium">
                  {{ similarPlayer.player_name }} {{ similarPlayer.player_surname }}
                  <span class="text-xs text-muted ml-1">
                    ({{ (combinedSimilarity * 100).toFixed(0) }}%)
                  </span>
                </span>
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-lucide-check"
                  @click="handleSelectExisting(similarPlayer.player_id)"
                >
                  Seleziona
                </UButton>
              </li>
            </ul>

            <p class="text-xs text-muted">
              Se il giocatore è nella lista, clicca "Seleziona" per aggiungerlo all'evento.
            </p>
          </div>
        </UCard>

        <!-- Messaggio OK quando non ci sono match (solo in creazione) -->
        <div
          v-else-if="!isEditing && isValid && !hasSimilarPlayers"
          class="flex items-center gap-2 text-success text-sm"
        >
          <UIcon name="i-lucide-check-circle" />
          <span>Nessun giocatore simile trovato. Puoi procedere con la creazione.</span>
        </div>
      </form>
    </template>

    <template #footer>
      <CancelButton @click="handleCancel" />
      <UButton
        type="submit"
        form="player-form"
        color="primary"
        :disabled="!canCreate"
        >
        {{ submitLabel }}
      </UButton>
    </template>
  </UModal>
</template>
