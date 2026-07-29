<!-- app\components\event\modal\EventCommanderModal.vue -->
<script setup lang="ts">
import type CommanderModal from '~/components/commander/CommanderModal.vue'
import type { Player } from '#shared/utils/types'

const { t } = useI18n()

const {
  showCommanderModal,
  selectedPlayerId,
  getPlayerName,
  getPlayer,
  commandersStore,
  tablePlayerIds = [],
} = defineProps<{
  showCommanderModal: boolean
  selectedPlayerId: number | null
  getPlayerName: (playerId: number) => string
  getPlayer: (playerId: number) => Player | undefined
  commandersStore: ReturnType<typeof import('~/stores/commanders').useCommandersStore>
  /** Every player seated at the same table/round as `selectedPlayerId` — see
   *  useCommanderSearch's `tablePlayerIds` option for why this is worth passing. */
  tablePlayerIds?: number[]
}>()

const commanderModalRef = useTemplateRef<InstanceType<typeof CommanderModal>>('commanderModalRef')

const emit = defineEmits<{
  submit: [commander1: string | null, commander2: string | null]
  cancel: []
}>()

const open = computed({
  get: () => showCommanderModal,
  set: (val) => { if (!val) emit('cancel') },
})

// Blocks "Salva" until commander2 is filled in, when commander1 requires a
// second card (partner/background/companion/etc.) — see CommanderModal's
// canSubmit for the actual rule.
const canSubmit = computed(() => commanderModalRef.value?.canSubmit ?? false)

function onSubmit() {
  commanderModalRef.value?.submit()
}

// Whitelist catalog is shared/cached (useCommanderCatalogQuery) — CommanderModal
// calls the same composable for whitelists/getPartnerType, this call only
// needs isLoading/refetch for the footer's refresh button.
const { isLoading: isRefreshingCatalog, refetch: refetchCatalog } = useCommanderWhitelists()

const showRefreshCatalogConfirm = ref(false)

const refreshCatalogLogging = useButtonLogging('Refresh Commander Catalog')

async function onConfirmRefreshCatalog() {
  refreshCatalogLogging.logClick()
  await refetchCatalog()
  showRefreshCatalogConfirm.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('event.commanderModal.title')"
    :scrollable="true"
    :ui="{
      content: 'w-[calc(100vw-2rem)] max-w-4xl rounded-lg shadow-lg ring ring-default',
      body: 'flex-1 p-4 sm:p-6'
    }"
  >
    <template #description>
      <PlayerNameTag
        v-if="selectedPlayerId && getPlayer(selectedPlayerId)"
        :name="getPlayer(selectedPlayerId)!.player_name"
        :surname="getPlayer(selectedPlayerId)!.player_surname"
        :player-id="selectedPlayerId"
        avatar-size="xs"
      />
      <span v-else-if="selectedPlayerId">{{ getPlayerName(selectedPlayerId) }}</span>
    </template>

    <template #body>
      <CommanderModal
        v-if="selectedPlayerId"
        ref="commanderModalRef"
        :player-id="selectedPlayerId"
        :player-name="getPlayerName(selectedPlayerId)"
        :commander1="commandersStore.getCommander1(selectedPlayerId)"
        :commander2="commandersStore.getCommander2(selectedPlayerId)"
        :table-player-ids="tablePlayerIds"
        @submit="(cmd1, cmd2) => emit('submit', cmd1, cmd2)"
      />
    </template>

    <template #footer>
      <ModalFooterActions
        :confirm-label="t('common.save')"
        :confirm-disabled="!canSubmit"
        @cancel="emit('cancel')"
        @confirm="onSubmit"
      >
        <template #start>
          <UButton
            :icon="ICONS.refresh"
            :label="isRefreshingCatalog ? t('commander.refreshingCatalog') : t('commander.refreshCatalog')"
            variant="outline"
            color="warning"
            :loading="isRefreshingCatalog"
            @click="() => { showRefreshCatalogConfirm = true }"
          />
        </template>
      </ModalFooterActions>
    </template>
  </UModal>

  <ConfirmModal
    v-model:open="showRefreshCatalogConfirm"
    :title="t('commander.refreshCatalogConfirm.title')"
    :description="t('commander.refreshCatalogConfirm.description')"
    :question="t('commander.refreshCatalogConfirm.question')"
    :warning="t('commander.refreshCatalogConfirm.warning')"
    :confirm-label="t('commander.refreshCatalog')"
    :confirm-icon="ICONS.refresh"
    confirm-color="warning"
    :loading="isRefreshingCatalog"
    @confirm="onConfirmRefreshCatalog"
  />
</template>
