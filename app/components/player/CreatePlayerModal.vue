<!-- app\components\player\CreatePlayerModal.vue -->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- FormModal invocation boilerplate + props/emit shape coincidence, see app/components/ui/CLAUDE.md
import type { Player, NewPlayer, MtgFormat } from '#shared/utils/types'
import type { PlayerUpdatePayload } from '~/composables/players/usePlayerMutations'
import { findSimilarPlayers } from '#shared/utils/playerSimilarity'
import { Constants } from '#shared/utils/types/database'
import * as v from 'valibot'

const props = defineProps<{
  player: Player | null
  existingPlayers: Player[]
  /** Changes what "similar player found" resolves to: adding to the current
   * event's waiting list ('event') vs. just locating them in the /players
   * table via search ('players') — the two contexts this modal is used in. */
  context: 'event' | 'players'
}>()

const { t } = useI18n()

const emit = defineEmits<{
  create: [player: NewPlayer]
  update: [PlayerUpdatePayload]
  select: [playerId: number]
  search: [query: string]
}>()

const open = defineModel<boolean>('open', { default: false })

const submitLogging = useButtonLogging('Submit Player Form', { isEditing: () => isEditing.value, data: () => ({ firstName: form.firstName, lastName: form.lastName }) })
const selectExistingLogging = useButtonLogging('Select Existing Player')

const PlayerFormSchema = v.object({
  player_name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  player_surname: v.pipe(v.string(), v.trim(), v.minLength(1)),
  is_active: v.boolean(),
  formats_played: v.nullable(v.array(v.picklist(Constants.public.Enums.mtg_formats))),
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
const formatItems = Constants.public.Enums.mtg_formats

const defaultForm = (): { firstName: string, lastName: string, isActive: boolean, formatsPlayed: MtgFormat[] } => ({
  firstName: '',
  lastName: '',
  isActive: true,
  formatsPlayed: [],
})

const form = shallowReactive(defaultForm())

const isValid = computed(() => !!form.firstName.trim() && !!form.lastName.trim())

// — Similarity check (creation mode only) —
const similarPlayers = computed(() => {
  if (isEditing.value || !isValid.value) return []
  return findSimilarPlayers(props.existingPlayers, form.firstName, form.lastName)
})

const hasSimilarPlayers = computed(() => similarPlayers.value.length > 0)

watch(open, (isOpen) => {
  if (!isOpen) return

  const p = props.player
  Object.assign(form, p
    ? { firstName: p.player_name, lastName: p.player_surname, isActive: p.is_active, formatsPlayed: p.formats_played ?? [] }
    : defaultForm()
  )
})

function handleSubmit() {
  const data: NewPlayer = {
    player_name: form.firstName.trim(),
    player_surname: form.lastName.trim(),
    is_active: form.isActive,
    formats_played: form.formatsPlayed.length ? form.formatsPlayed : null,
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

function toggleFormat(format: MtgFormat) {
  form.formatsPlayed = form.formatsPlayed.includes(format)
    ? form.formatsPlayed.filter((f) => f !== format)
    : [...form.formatsPlayed, format]
}

function handleSelectExisting(playerId: number) {
  selectExistingLogging.logClick()
  emit('select', playerId)
  Object.assign(form, defaultForm())
  open.value = false
}

function handleSearchExisting(name: string) {
  selectExistingLogging.logClick()
  emit('search', name)
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
    :disabled="!isValid"
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

        <UFormField :label="t('player.form.formatsLabel')">
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="format in formatItems"
              :key="format"
              type="button"
              size="sm"
              :variant="form.formatsPlayed.includes(format) ? 'solid' : 'outline'"
              :color="form.formatsPlayed.includes(format) ? 'primary' : 'neutral'"
              @click="toggleFormat(format)"
            >
              {{ format }}
            </UButton>
          </div>
        </UFormField>

        <UFormField :label="t('player.form.activeLabel')">
          <USwitch id="field-active" v-model="form.isActive" />
        </UFormField>

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
                <span class="flex items-center gap-1.5 font-medium">
                  <PlayerNameTag
                    :name="similarPlayer.player_name"
                    :surname="similarPlayer.player_surname"
                    :player-id="similarPlayer.player_id"
                    :linkable="false"
                    avatar-size="xs"
                  />
                  <span class="text-xs text-muted">
                    ({{ (combinedSimilarity * 100).toFixed(0) }}%)
                  </span>
                </span>
                <UButton
                  v-if="context === 'event'"
                  size="xs"
                  color="primary"
                  variant="soft"
                  :icon="ICONS.confirm"
                  @click="handleSelectExisting(similarPlayer.player_id)"
                >
                  {{ t('player.form.select') }}
                </UButton>
                <UButton
                  v-else
                  size="xs"
                  color="primary"
                  variant="soft"
                  :icon="ICONS.search"
                  @click="handleSearchExisting(`${similarPlayer.player_name} ${similarPlayer.player_surname}`)"
                >
                  {{ t('player.form.search') }}
                </UButton>
              </li>
            </ul>

            <p class="text-xs text-muted">
              {{ t(context === 'event' ? 'player.form.similarHelpTextEvent' : 'player.form.similarHelpTextPlayers') }}
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
