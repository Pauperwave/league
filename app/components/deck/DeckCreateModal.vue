<!-- app\components\deck\DeckCreateModal.vue -->
<script setup lang="ts">
import * as v from 'valibot'

const DeckCreateSchema = v.object({
  player_id: v.number(),
  commander_1_name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  commander_2_name: v.nullable(v.string()),
  companion_name: v.nullable(v.string()),
  is_borrowed: v.boolean(),
  lender_id: v.nullable(v.number()),
})

const emit = defineEmits<{
  create: [deck: {
    player_id: number
    commander_1_name: string
    commander_2_name: string | null
    companion_name: string | null
    is_borrowed: boolean
    lender_id: number | null
  }]
}>()

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{
  playerId: number
}>()

const { t } = useI18n()

// — Form state —
const commander1 = ref('')
const commander2 = ref('')
const companion = ref('')

const { isBorrowed, lenderId, lenderOptions } = useLenderSelection(() => props.playerId)

const canSubmit = computed(() => {
  if (!commander1.value.trim()) return false
  if (isBorrowed.value && !lenderId.value) return false
  return true
})

watch(open, async (isOpen) => {
  if (!isOpen) return

  commander1.value = ''
  commander2.value = ''
  companion.value = ''
  isBorrowed.value = false
  lenderId.value = undefined
})

function handleSubmit() {
  if (!canSubmit.value) return

  const data = {
    player_id: props.playerId,
    commander_1_name: commander1.value.trim(),
    commander_2_name: commander2.value.trim() || null,
    companion_name: companion.value.trim() || null,
    is_borrowed: isBorrowed.value,
    lender_id: isBorrowed.value ? (lenderId.value ? Number(lenderId.value) : null) : null
  }

  const parsed = v.safeParse(DeckCreateSchema, data)
  if (!parsed.success) {
    logError('DeckCreateModal', 'Deck form validation failed', parsed.issues)
    return
  }

  emit('create', parsed.output)
  open.value = false
}

function handleCancel() {
  open.value = false
}
</script>

<template>
  <FormModal
    v-model:open="open"
    :title="t('deck.newModal.title')"
    :description="t('deck.newModal.description')"
    :icon="ICONS.add"
    :submit-label="t('deck.newModal.submit')"
    :submit-icon="ICONS.add"
    form-id="deck-create-form"
    :disabled="!canSubmit"
    @cancel="handleCancel"
  >
    <form id="deck-create-form" class="space-y-4" @submit.prevent="handleSubmit">
        <!-- Commander 1 -->
        <UFormField :label="t('deck.newModal.commanderLabel')" required>
          <UInput
            v-model="commander1"
            :placeholder="t('deck.newModal.commanderPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <!-- Commander 2 -->
        <UFormField :label="t('deck.newModal.partnerLabel')">
          <UInput
            v-model="commander2"
            :placeholder="t('deck.newModal.partnerPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <!-- Companion -->
        <UFormField :label="t('deck.newModal.companionLabel')">
          <UInput
            v-model="companion"
            :placeholder="t('deck.newModal.companionPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <!-- Borrowed -->
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
      </form>
  </FormModal>
</template>
