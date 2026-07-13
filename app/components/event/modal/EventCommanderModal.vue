<!-- app\components\events\modals\EventCommanderModal.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const {
  showCommanderModal,
  selectedPlayerId,
  commanderModalRef,
  getPlayerName,
  commandersStore,
} = defineProps<{
  showCommanderModal: boolean
  selectedPlayerId: number | null
  commanderModalRef: InstanceType<typeof import('~/components/commander/CommanderModal.vue').default> | null
  getPlayerName: (playerId: number) => string
  commandersStore: ReturnType<typeof import('~/stores/commanders').useCommandersStore>
}>()

const emit = defineEmits<{
  submit: [commander1: string | null, commander2: string | null]
  cancel: []
}>()

const open = computed({
  get: () => showCommanderModal,
  set: (val) => { if (!val) emit('cancel') },
})

function onSubmit() {
  commanderModalRef?.submit()
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('event.commanderModal.title')"
    :description="selectedPlayerId ? getPlayerName(selectedPlayerId) : ''"
    :scrollable="true"
    :ui="{
      content: 'w-[calc(100vw-2rem)] max-w-4xl rounded-lg shadow-lg ring ring-default',
      body: 'flex-1 p-4 sm:p-6 min-h-[60vh]'
    }"
  >
    <template #body>
      <CommanderModal
        v-if="selectedPlayerId"
        ref="commanderModalRef"
        :player-id="selectedPlayerId"
        :player-name="getPlayerName(selectedPlayerId)"
        :commander1="commandersStore.getCommander1(selectedPlayerId)"
        :commander2="commandersStore.getCommander2(selectedPlayerId)"
        @submit="(cmd1, cmd2) => emit('submit', cmd1, cmd2)"
      />
    </template>

    <template #footer>
      <ModalFooterActions
        :confirm-label="t('common.save')"
        @cancel="emit('cancel')"
        @confirm="onSubmit"
      />
    </template>
  </UModal>
</template>
