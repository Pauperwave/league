<!-- app\components\deck\DeckEditModal.vue -->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- FormModal invocation boilerplate, see app/components/ui/CLAUDE.md
import type { CommanderDeck } from '#shared/utils/types'
import type { DeckUpdatePayload } from '~/composables/deck/useDeckMutations'
import * as v from 'valibot'

const DeckUpdateSchema = v.object({
  is_borrowed: v.boolean(),
  lender_id: v.nullable(v.number()),
})

const props = defineProps<{
  deck: CommanderDeck | null
  playerId: number
}>()

const emit = defineEmits<{
  update: [DeckUpdatePayload]
}>()

const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const { isBorrowed, lenderId, lenderOptions } = useLenderSelection(() => props.playerId)

watch(open, async (isOpen) => {
  if (!isOpen) return

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

  const data = {
    is_borrowed: isBorrowed.value,
    lender_id: isBorrowed.value ? (lenderId.value ? Number(lenderId.value) : null) : null,
  }

  const parsed = v.safeParse(DeckUpdateSchema, data)
  if (!parsed.success) {
    logError('DeckEditModal', 'Deck form validation failed', parsed.issues)
    return
  }

  emit('update', { id: props.deck.id, updates: parsed.output })
  open.value = false
}

function handleCancel() {
  open.value = false
}
</script>

<template>
  <FormModal
    v-model:open="open"
    :title="t('deck.editModal.title')"
    :description="t('deck.editModal.description')"
    :icon="ICONS.edit"
    :submit-label="t('common.save')"
    form-id="deck-form"
    :disabled="isBorrowed && !lenderId"
    @cancel="handleCancel"
  >
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

        <!-- Lender -->
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
  </FormModal>
</template>
