<!-- app\components\Modals\CreatePlayerModal.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import type { Player, NewPlayer } from '#shared/utils/types'
import { findSimilarPlayers } from '#shared/utils/playerSimilarity'
import * as v from 'valibot'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'

const props = defineProps<{
  player: Player | null
  existingPlayers: Player[]
}>()

const { t } = useI18n()

const emit = defineEmits<{
  create: [player: NewPlayer]
  update: [{ id: number, data: NewPlayer }]
  select: [playerId: number]
}>()

const open = defineModel<boolean>('open', { default: false })

const submitLogging = useButtonLogging('Submit Player Form', { isEditing: () => isEditing.value, data: () => ({ firstName: form.firstName, lastName: form.lastName }) })
const selectExistingLogging = useButtonLogging('Select Existing Player')

const PlayerFormSchema = v.object({
  player_name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  player_surname: v.pipe(v.string(), v.trim(), v.minLength(1)),
})

// — Derived modal state —
const isEditing = computed(() => !!props.player)
const { title: modalTitle, description: modalDescription, icon: modalIcon, submitLabel, handleCancel } = useFormModalMeta({
  isEditing,
  namespace: 'player',
  createIcon: ICONS.addPlayer,
  cancelLoggingLabel: 'Cancel Player Form',
  open
})

// — Form —
const defaultForm = (): { firstName: string, lastName: string } => ({
  firstName: '',
  lastName: '',
})

const form = shallowReactive(defaultForm())

const isValid = computed(() => !!form.firstName.trim() && !!form.lastName.trim())

// — Similarity check (creation mode only) —
const similarPlayers = computed(() => {
  if (isEditing.value || !isValid.value) return []
  return findSimilarPlayers(props.existingPlayers, form.firstName, form.lastName)
})

const hasSimilarPlayers = computed(() => similarPlayers.value.length > 0)

const canCreate = computed(() => {
  if (!isValid.value) return false
  // When editing: always valid
  if (isEditing.value) return true
  // When creating: valid only if there are no similar players
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
  const data: NewPlayer = {
    player_name: form.firstName.trim(),
    player_surname: form.lastName.trim(),
  }

  const parsed = v.safeParse(PlayerFormSchema, data)
  if (!parsed.success) {
    logError('CreatePlayerModal', 'Player form validation failed', parsed.issues)
    return
  }

  submitLogging.logClick()

  if (isEditing.value && props.player) {
    emit('update', { id: props.player.player_id, data: parsed.output })
  }
  else {
    emit('create', parsed.output)
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


</script>

<template>
  <FormModal
    v-model:open="open"
    :title="modalTitle"
    :description="modalDescription"
    :icon="modalIcon"
    :submit-label="submitLabel"
    form-id="player-form"
    :disabled="!canCreate"
    @cancel="handleCancel"
  >
    <form id="player-form" class="space-y-4" @submit.prevent="handleSubmit">
        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="t('player.form.firstNameLabel')" required>
            <UInput
              id="field-firstname"
              v-model="form.firstName"
              :placeholder="t('player.form.firstNamePlaceholder')"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('player.form.lastNameLabel')" required>
            <UInput
              id="field-lastname"
              v-model="form.lastName"
              :placeholder="t('player.form.lastNamePlaceholder')"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Warning: similar players found (creation only) -->
        <UCard
          v-if="!isEditing && hasSimilarPlayers"
          variant="outline"
          class="border-warning"
        >
          <div class="space-y-3">
            <div class="flex items-center gap-2 text-warning">
              <UIcon :name="ICONS.warning" class="size-5" />
              <span class="font-medium">{{ t('player.form.similarFoundHeading') }}</span>
            </div>

            <p class="text-sm text-muted">
              {{ t('player.form.similarFoundHint') }}
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
                  :icon="ICONS.confirm"
                  @click="handleSelectExisting(similarPlayer.player_id)"
                >
                  {{ t('player.form.select') }}
                </UButton>
              </li>
            </ul>

            <p class="text-xs text-muted">
              {{ t('player.form.similarHelpText') }}
            </p>
          </div>
        </UCard>

        <!-- OK message when there are no matches (creation only) -->
        <div
          v-else-if="!isEditing && isValid && !hasSimilarPlayers"
          class="flex items-center gap-2 text-success text-sm"
        >
          <UIcon :name="ICONS.success" />
          <span>{{ t('player.form.noSimilarFound') }}</span>
        </div>
      </form>
  </FormModal>
</template>
