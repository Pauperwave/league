<!-- app\components\deck\BracketPickerModal.vue -->
<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

const { deckName, currentLevel = null } = defineProps<{
  deckName: string
  currentLevel?: number | null
}>()

const emit = defineEmits<{
  confirm: [level: number]
  cancel: []
}>()

const { t } = useI18n()

const selected = ref<number | null>(currentLevel)

// Reset to the deck's current bracket whenever the modal is (re)opened —
// covers reopening for a different deck without unmounting the component.
watch(open, (isOpen) => {
  if (isOpen) selected.value = currentLevel
})

function selectedName(level: number | null): string {
  if (level === null) return ''
  return t(BRACKET_LEVELS[level - 1]!.nameKey)
}

function onCancel() {
  emit('cancel')
  open.value = false
}

function onConfirm() {
  if (selected.value === null) return
  emit('confirm', selected.value)
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('deck.bracket.modalTitle')"
    :description="t('deck.bracket.modalSubtitle', { deckName })"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-2">
        <button
          v-for="definition in BRACKET_LEVELS"
          :key="definition.level"
          type="button"
          class="w-full flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-colors"
          :class="selected === definition.level ? 'border-primary bg-primary/5' : 'border-default hover:border-muted bg-elevated'"
          @click="selected = definition.level"
        >
          <UBadge
            :color="BRACKET_COLORS[definition.level]"
            variant="soft"
            size="lg"
            class="shrink-0 size-8 rounded-md flex items-center justify-center font-mono font-bold tabular-nums"
          >
            {{ definition.level }}
          </UBadge>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold text-sm">{{ t(definition.nameKey) }}</span>
              <UIcon
                v-if="selected === definition.level"
                :name="ICONS.confirm"
                class="size-4 shrink-0 text-primary"
              />
            </div>
            <p class="text-sm mt-1">{{ t(definition.experienceKey) }}</p>
            <p class="text-xs text-muted mt-1.5 pt-1.5 border-t border-dashed border-default">
              <b>{{ t('deck.bracket.deckBuildingLabel') }}:</b> {{ t(definition.deckBuildingKey) }}
            </p>
          </div>
        </button>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between w-full gap-4">
        <span class="text-sm text-muted">
          {{ selected !== null ? t('deck.bracket.selectedStatus', { level: selected, name: selectedName(selected) }) : '' }}
        </span>
        <ModalFooterActions
          :confirm-label="t('common.save')"
          :confirm-disabled="selected === null"
          @cancel="onCancel"
          @confirm="onConfirm"
        />
      </div>
    </template>
  </UModal>
</template>
