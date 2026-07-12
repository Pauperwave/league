<!-- app\components\Modals\DeckEditModal.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import type { CommanderDeck } from '#shared/utils/types'

const props = defineProps<{
  deck: CommanderDeck | null
  playerId: number
}>()

const emit = defineEmits<{
  update: [{ id: number; updates: Partial<CommanderDeck> }]
}>()

const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const playersStore = usePlayerStore()

  // — Form state —
  const isBorrowed = ref(false)
  const lenderId = ref<string | undefined>(undefined)

  const lenderOptions = computed(() => {
    return playersStore.players
      .filter(p => p.player_id !== props.playerId)
      .map(p => ({
        label: `${p.player_name} ${p.player_surname}`,
        value: String(p.player_id)
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  })

  watch(open, async (isOpen) => {
    if (!isOpen) return

    // Ensure players are loaded before showing options
    if (playersStore.players.length === 0) {
      await playersStore.fetchPlayers()
    }

    const d = props.deck
    if (d) {
      isBorrowed.value = d.is_borrowed
      lenderId.value = d.lender_id ? String(d.lender_id) : undefined
    } else {
      isBorrowed.value = false
      lenderId.value = undefined
    }
  })

  function handleSubmit() {
    if (!props.deck) return

    const updates: Partial<CommanderDeck> = {
      is_borrowed: isBorrowed.value
    }

    if (isBorrowed.value) {
      updates.lender_id = lenderId.value ? Number(lenderId.value) : null
    } else {
      updates.lender_id = null
    }

    emit('update', { id: props.deck.id, updates })
    open.value = false
  }

function handleCancel() {
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :description="t('deck.editModal.description')"
    :ui="{ footer: 'justify-between' }"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon :name="ICONS.edit" class="text-primary" />
        <span>{{ t('deck.editModal.title') }}</span>
      </div>
    </template>

    <template #body>
      <form id="deck-form" class="space-y-4" @submit.prevent="handleSubmit">
        <UCard variant="outline">
          <div class="flex items-center gap-3">
            <USwitch v-model="isBorrowed" />
            <div>
              <p class="font-medium">{{ t('deck.ownership.borrowedTitle') }}</p>
              <p class="text-sm text-muted">
                {{ t('deck.ownership.borrowedDescription') }}
              </p>
            </div>
          </div>
        </UCard>

        <UFormField
          v-if="isBorrowed"
          :label="t('deck.ownership.lenderLabel')"
          required
        >
          <USelectMenu
            v-model="lenderId"
            :items="lenderOptions"
            value-key="value"
            :placeholder="t('deck.ownership.lenderPlaceholder')"
            :search-input="{ placeholder: t('deck.ownership.lenderSearchPlaceholder') }"
            class="w-full"
          />
        </UFormField>

        <div v-if="isBorrowed && !lenderId" class="text-sm text-warning flex items-center gap-1.5">
          <UIcon :name="ICONS.warning" class="size-4" />
          <span>{{ t('deck.editModal.selectLenderWarning') }}</span>
        </div>
      </form>
    </template>

    <template #footer>
      <CancelButton @click="handleCancel" />
      <UButton
        type="submit"
        form="deck-form"
        color="primary"
        :disabled="isBorrowed && !lenderId"
      >
        {{ t('common.save') }}
      </UButton>
    </template>
  </UModal>
</template>
